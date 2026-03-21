import { randomUUID } from 'crypto';
import pino from 'pino';
export class WorkflowEngine {
    harness;
    agentRegistry;
    communication;
    knowledgeBase;
    logger;
    emit;
    constructor(harness, agentRegistry, communication, knowledgeBase, emit, logger) {
        this.harness = harness;
        this.agentRegistry = agentRegistry;
        this.communication = communication;
        this.knowledgeBase = knowledgeBase;
        this.emit = emit;
        this.logger = logger ?? pino({ name: 'WorkflowEngine' });
    }
    async run(definition, input) {
        const runId = randomUUID();
        const startedAt = Date.now();
        const run = {
            id: runId,
            workflowId: definition.id,
            status: 'running',
            input,
            stepResults: {},
            startedAt,
            totalTokens: 0,
        };
        this.emit({
            type: 'workflow:started',
            payload: { workflowId: definition.id, runId, pattern: definition.pattern },
            timestamp: startedAt,
        });
        this.logger.info({ runId, workflowId: definition.id, pattern: definition.pattern }, 'Workflow started');
        try {
            switch (definition.pattern) {
                case 'pipeline':
                    await this.runPipeline(definition, run);
                    break;
                case 'fan-out':
                    await this.runFanOut(definition, run);
                    break;
                case 'swarm':
                    await this.runSwarm(definition, run);
                    break;
                case 'review':
                    await this.runReview(definition, run);
                    break;
            }
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            run.status = 'failed';
            run.error = errorMessage;
            run.completedAt = Date.now();
            this.emit({
                type: 'workflow:failed',
                payload: { runId, error: errorMessage },
                timestamp: Date.now(),
            });
        }
        if (run.status === 'running') {
            run.status = 'success';
        }
        if (!run.completedAt) {
            run.completedAt = Date.now();
        }
        this.emit({
            type: 'workflow:completed',
            payload: {
                runId,
                status: run.status,
                totalTokens: run.totalTokens,
                durationMs: run.completedAt - run.startedAt,
            },
            timestamp: Date.now(),
        });
        return run;
    }
    async runPipeline(definition, run) {
        let currentInput = run.input;
        let currentStepIndex = 0;
        const maxIterations = definition.steps.length * 3; // Prevent infinite loops
        let iterations = 0;
        while (currentStepIndex < definition.steps.length && iterations < maxIterations) {
            iterations++;
            const step = definition.steps[currentStepIndex];
            if (!step)
                break;
            const stepInput = this.interpolateInput(step.input, run.stepResults, currentInput, run.input);
            if (step.condition && !this.checkCondition(step.condition, currentInput)) {
                this.logger.info({ stepId: step.id }, 'Step skipped due to condition');
                run.stepResults[step.id] = {
                    agentId: step.agentId,
                    status: 'cancelled',
                    output: 'Skipped due to condition',
                    durationMs: 0,
                    tokens: 0,
                    startedAt: Date.now(),
                    completedAt: Date.now(),
                };
                currentStepIndex++;
                continue;
            }
            // Execute step with retry
            let retries = 0;
            const maxRetries = step.maxRetries ?? 0;
            let result;
            do {
                result = await this.executeStep(step, run, stepInput);
                // Check if output is valid
                if (step.validateOutput && result.status === 'success') {
                    const isValid = this.checkCondition(step.validateOutput, result.output);
                    if (!isValid) {
                        this.logger.info({ stepId: step.id, output: result.output.substring(0, 100) }, 'Output validation failed');
                        if (retries < maxRetries) {
                            retries++;
                            continue;
                        }
                        // Validation failed, go to onFailure step if defined
                        if (step.onFailure) {
                            const failStepIndex = definition.steps.findIndex(s => s.id === step.onFailure);
                            if (failStepIndex >= 0) {
                                currentStepIndex = failStepIndex;
                                currentInput = result.output;
                                break;
                            }
                        }
                        result.status = 'failed';
                        result.output = `Validation failed: ${step.validateOutput}`;
                    }
                }
                break;
            } while (retries <= maxRetries);
            run.stepResults[step.id ?? 'unknown'] = result;
            // Send message to next agent if there is one
            if (result.status === 'success' && currentStepIndex < definition.steps.length - 1) {
                const nextStep = definition.steps[currentStepIndex + 1];
                if (nextStep && step) {
                    try {
                        this.communication.send(step.agentId, nextStep.agentId, `[Workflow: ${definition.name}] Result from ${step.id}:\n${result.output.substring(0, 500)}`, `workflow-${run.id}`);
                    }
                    catch (err) {
                        this.logger.warn({ err }, 'Failed to send inter-step message');
                    }
                }
            }
            if (result.status === 'failed' || result.status === 'cancelled') {
                // Go to onFailure step if defined
                if (step.onFailure) {
                    const failStepIndex = definition.steps.findIndex(s => s.id === step.onFailure);
                    if (failStepIndex >= 0) {
                        currentStepIndex = failStepIndex;
                        currentInput = result.output;
                        continue;
                    }
                }
                run.status = 'failed';
                run.error = `Step ${step.id} failed: ${result.output}`;
                return;
            }
            currentInput = result.output;
            // Go to onSuccess step if defined, otherwise next step
            if (step.onSuccess) {
                const successStepIndex = definition.steps.findIndex(s => s.id === step.onSuccess);
                if (successStepIndex >= 0) {
                    currentStepIndex = successStepIndex;
                    continue;
                }
            }
            currentStepIndex++;
        }
        run.finalOutput = currentInput;
    }
    async runFanOut(definition, run) {
        const promises = definition.steps.map((step) => this.executeStep(step, run, this.interpolateInput(step.input, {}, run.input, run.input)));
        const results = await Promise.allSettled(promises);
        results.forEach((result, index) => {
            const step = definition.steps[index];
            if (step) {
                if (result.status === 'fulfilled') {
                    run.stepResults[step.id] = result.value;
                }
                else {
                    run.stepResults[step.id] = {
                        agentId: step.agentId,
                        status: 'failed',
                        output: '',
                        durationMs: 0,
                        tokens: 0,
                        startedAt: Date.now(),
                        completedAt: Date.now(),
                    };
                }
            }
        });
        if (definition.combinePrompt) {
            const combinedInput = definition.steps
                .map((step) => `[${step.agentId}]\n${run.stepResults[step.id]?.output || ''}`)
                .join('\n\n---\n\n');
            const combineAgent = definition.steps[0]?.agentId;
            if (combineAgent) {
                const agentConfig = this.agentRegistry.get(combineAgent);
                if (agentConfig) {
                    const combineResult = await this.harness.execute(agentConfig, {
                        id: randomUUID(),
                        agentId: combineAgent,
                        input: `${definition.combinePrompt}\n\nResults to combine:\n\n${combinedInput}`,
                        context: {},
                        priority: 'normal',
                        createdAt: Date.now(),
                    });
                    run.finalOutput = combineResult.output;
                    run.totalTokens += combineResult.usage.inputTokens + combineResult.usage.outputTokens;
                }
            }
        }
        else {
            run.finalOutput = definition.steps
                .map((step) => `=== ${step.agentId} ===\n${run.stepResults[step.id]?.output || ''}`)
                .join('\n\n');
        }
    }
    async runSwarm(definition, run) {
        const promises = definition.steps.map((step) => this.executeStep(step, run, run.input));
        const results = await Promise.allSettled(promises);
        results.forEach((result, index) => {
            const step = definition.steps[index];
            if (step) {
                if (result.status === 'fulfilled') {
                    run.stepResults[step.id] = result.value;
                }
                else {
                    run.stepResults[step.id] = {
                        agentId: step.agentId,
                        status: 'failed',
                        output: '',
                        durationMs: 0,
                        tokens: 0,
                        startedAt: Date.now(),
                        completedAt: Date.now(),
                    };
                }
            }
        });
        const successfulResults = [];
        for (const step of definition.steps) {
            const result = run.stepResults[step.id];
            if (result?.status === 'success') {
                const score = this.simpleVerify(result.output, run.input);
                successfulResults.push({ step, result, score });
            }
        }
        if (successfulResults.length === 0) {
            run.status = 'failed';
            run.error = 'All swarm agents failed';
            return;
        }
        successfulResults.sort((a, b) => b.score - a.score);
        const best = successfulResults[0];
        if (best) {
            run.finalOutput = best.result.output;
            if (this.knowledgeBase) {
                await this.knowledgeBase.addSuccess(best.step.agentId, `Swarm result: ${run.input.substring(0, 50)}...`, `Best approach selected from ${successfulResults.length} candidates. Score: ${best.score.toFixed(2)}`);
            }
        }
    }
    simpleVerify(output, input) {
        let score = 50;
        if (output.length > input.length * 0.5) {
            score += 20;
        }
        if (output.includes('```') || output.includes('function') || output.includes('class')) {
            score += 15;
        }
        if (output.length > 100) {
            score += 10;
        }
        if (output.toLowerCase().includes('error') || output.toLowerCase().includes('failed')) {
            score -= 20;
        }
        return Math.max(0, Math.min(100, score));
    }
    async runReview(definition, run) {
        if (!definition.reviewAgentId || definition.steps.length === 0) {
            run.status = 'failed';
            run.error = 'Review pattern requires reviewAgentId and at least one step';
            return;
        }
        const executorStep = definition.steps[0];
        if (!executorStep) {
            run.status = 'failed';
            run.error = 'No steps defined';
            return;
        }
        let currentInput = run.input;
        let cycles = 0;
        const maxCycles = 3;
        while (cycles < maxCycles) {
            cycles++;
            const result = await this.executeStep(executorStep, run, currentInput);
            if (result.status === 'failed') {
                run.status = 'failed';
                run.error = `Executor failed: ${result.output}`;
                return;
            }
            const reviewResult = await this.executeReview(definition.reviewAgentId, run.input, result.output);
            let review;
            try {
                review = JSON.parse(reviewResult.output);
            }
            catch {
                review = {
                    approved: false,
                    score: 0,
                    feedback: 'Failed to parse review response',
                    suggestions: [],
                };
            }
            if (review.approved === true || review.score >= 70) {
                run.finalOutput = result.output;
                return;
            }
            if (cycles >= maxCycles) {
                run.status = 'failed';
                run.error = `Review failed after ${maxCycles} cycles. Last score: ${review.score}`;
                return;
            }
            currentInput = `${run.input}\n\nReview feedback:\n${review.feedback}\n\nSuggestions:\n${review.suggestions?.join('\n') || 'None'}`;
            this.logger.info({ cycle: cycles, score: review.score }, 'Review cycle feedback');
        }
    }
    async executeReview(reviewAgentId, originalTask, workDone) {
        const startedAt = Date.now();
        const agentConfig = this.agentRegistry.get(reviewAgentId);
        if (!agentConfig) {
            return {
                agentId: reviewAgentId,
                status: 'failed',
                output: '',
                durationMs: Date.now() - startedAt,
                tokens: 0,
                startedAt,
                completedAt: Date.now(),
            };
        }
        this.emit({
            type: 'workflow:step:started',
            payload: { stepId: 'review', agentId: reviewAgentId, runId: randomUUID() },
            timestamp: startedAt,
        });
        const reviewPrompt = `Review this work:

Original task: ${originalTask}

Work done:
${workDone}

Respond with JSON:
{
  "approved": true/false,
  "score": 0-100,
  "feedback": "detailed feedback",
  "suggestions": ["suggestion 1", ...]
}`;
        const result = await this.harness.execute(agentConfig, {
            id: randomUUID(),
            agentId: reviewAgentId,
            input: reviewPrompt,
            context: {},
            priority: 'normal',
            createdAt: startedAt,
        });
        const stepResult = {
            agentId: reviewAgentId,
            status: result.status === 'success' ? 'success' : 'failed',
            output: result.output,
            durationMs: result.durationMs,
            tokens: result.usage.inputTokens + result.usage.outputTokens,
            startedAt,
            completedAt: Date.now(),
        };
        this.emit({
            type: 'workflow:step:completed',
            payload: {
                stepId: 'review',
                agentId: reviewAgentId,
                status: stepResult.status,
                durationMs: stepResult.durationMs,
            },
            timestamp: Date.now(),
        });
        return stepResult;
    }
    async executeStep(step, run, input) {
        const startedAt = Date.now();
        const agentConfig = this.agentRegistry.get(step.agentId);
        if (!agentConfig) {
            return {
                agentId: step.agentId,
                status: 'failed',
                output: `Agent ${step.agentId} not found`,
                durationMs: 0,
                tokens: 0,
                startedAt,
                completedAt: Date.now(),
            };
        }
        this.emit({
            type: 'workflow:step:started',
            payload: { runId: run.id, stepId: step.id, agentId: step.agentId },
            timestamp: startedAt,
        });
        this.logger.info({ stepId: step.id, agentId: step.agentId }, 'Executing step');
        const result = await this.harness.execute(agentConfig, {
            id: randomUUID(),
            agentId: step.agentId,
            input,
            context: {},
            priority: 'normal',
            createdAt: startedAt,
        });
        const stepResult = {
            agentId: step.agentId,
            status: result.status === 'success' ? 'success' : 'failed',
            output: result.output,
            durationMs: result.durationMs,
            tokens: result.usage.inputTokens + result.usage.outputTokens,
            startedAt,
            completedAt: Date.now(),
        };
        run.stepResults[step.id] = stepResult;
        run.totalTokens += stepResult.tokens;
        this.emit({
            type: 'workflow:step:completed',
            payload: {
                runId: run.id,
                stepId: step.id,
                agentId: step.agentId,
                status: stepResult.status,
                durationMs: stepResult.durationMs,
            },
            timestamp: Date.now(),
        });
        return stepResult;
    }
    interpolateInput(template, stepResults, previousOutput, userInput) {
        let result = template.replace(/\{\{previous\}\}/g, previousOutput);
        if (userInput) {
            result = result.replace(/\{\{input\}\}/g, userInput);
        }
        for (const [stepId, stepResult] of Object.entries(stepResults)) {
            result = result.replace(new RegExp(`\\{\\{${stepId}\\}\\}`, 'g'), stepResult.output);
        }
        return result;
    }
    checkCondition(condition, input) {
        if (condition.startsWith('contains:')) {
            const value = condition.substring(9).trim();
            return input.toLowerCase().includes(value.toLowerCase());
        }
        if (condition.startsWith('not_contains:')) {
            const value = condition.substring(13).trim();
            return !input.toLowerCase().includes(value.toLowerCase());
        }
        if (condition.startsWith('equals:')) {
            const value = condition.substring(7).trim();
            return input.trim() === value;
        }
        return true;
    }
}
//# sourceMappingURL=workflow-engine.js.map