import pino from 'pino';
import { randomUUID } from 'crypto';
import { SelfVerification } from './verification.js';
import { LoopDetector } from './loop-detector.js';
import { TraceAnalyzer } from './trace-analyzer.js';
import { RalphLoop } from './ralph-loop.js';
import { MiddlewarePipeline } from './middleware.js';
import { DirectoryContextMiddleware } from './middlewares/directory-context.js';
import { LoopProtectionMiddleware } from './middlewares/loop-protection.js';
import { PreCompletionMiddleware } from './middlewares/pre-completion.js';
import { RAGContextMiddleware } from './middlewares/rag-context.js';
import { ReasoningBudget } from './reasoning-budget.js';
export class Harness {
    client;
    runner;
    config;
    verification;
    loopDetector;
    traceAnalyzer;
    ralph;
    pipeline;
    loopProtection;
    reasoningBudget;
    knowledgeBase = null;
    logger;
    constructor(client, runner, config, logger) {
        this.client = client;
        this.runner = runner;
        this.config = config;
        this.verification = new SelfVerification(client, config.verificationThreshold);
        this.loopDetector = new LoopDetector(config.maxLoops);
        this.traceAnalyzer = new TraceAnalyzer();
        this.ralph = new RalphLoop();
        this.logger = logger ?? pino({ name: 'Harness' });
        this.pipeline = new MiddlewarePipeline(this.logger);
        this.loopProtection = new LoopProtectionMiddleware(5, this.logger);
        this.reasoningBudget = new ReasoningBudget(this.logger);
        this.setupMiddleware();
    }
    setKnowledgeBase(kb) {
        this.knowledgeBase = kb;
        this.pipeline.use(new RAGContextMiddleware(kb, this.logger));
        this.logger.info('KnowledgeBase connected to harness');
    }
    setupMiddleware() {
        this.pipeline.use(new DirectoryContextMiddleware('./workspace', undefined, this.logger));
        this.pipeline.use(this.loopProtection);
        this.pipeline.use(new PreCompletionMiddleware(this.client, this.logger));
        this.logger.info({ middlewares: this.pipeline.listMiddlewares() }, 'Middleware pipeline configured');
    }
    async execute(originalConfig, task) {
        this.logger.info({
            agentId: originalConfig.id,
            taskId: task.id,
            input: task.input.slice(0, 50),
        }, 'Harness: starting execution');
        if (this.loopDetector.isLooping(originalConfig.id, task.input)) {
            this.recordTrace({
                id: randomUUID(),
                agentId: originalConfig.id,
                taskId: task.id,
                timestamp: Date.now(),
                type: 'loop_detected',
                message: `Loop detected for task after ${this.config.maxLoops} attempts`,
            });
            return {
                taskId: task.id,
                agentId: originalConfig.id,
                status: 'failed',
                output: '',
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                durationMs: 0,
                attempts: 0,
                error: 'Loop detected: task signature repeated too many times',
                completedAt: Date.now(),
            };
        }
        this.recordTrace({
            id: randomUUID(),
            agentId: originalConfig.id,
            taskId: task.id,
            timestamp: Date.now(),
            type: 'start',
            message: 'Execution started',
        });
        this.loopDetector.record(originalConfig.id, task.input);
        const reasoningConfig = this.reasoningBudget.getReasoningConfig(originalConfig.level);
        let attempts = 0;
        const maxAttempts = originalConfig.maxRetries ?? this.config.maxRetries;
        let currentTask = task;
        let loopWarning;
        let finalResult = null;
        while (attempts < maxAttempts) {
            attempts++;
            const phaseConfig = this.getPhaseConfig(reasoningConfig, 'planning');
            this.recordTrace({
                id: randomUUID(),
                agentId: originalConfig.id,
                taskId: task.id,
                timestamp: Date.now(),
                type: 'planning',
                message: `Planning phase (${phaseConfig.level})`,
                metadata: { temperature: phaseConfig.temperature, maxTokens: phaseConfig.maxTokens },
            });
            const preExecCtx = await this.pipeline.run('pre-execution', {
                agentId: originalConfig.id,
                taskId: task.id,
                task: currentTask,
                config: originalConfig,
                phase: 'pre-execution',
                metadata: {},
            });
            if (preExecCtx.injectedContext) {
                currentTask = {
                    ...currentTask,
                    input: `${currentTask.input}\n\n${preExecCtx.injectedContext}`,
                };
            }
            if (loopWarning) {
                currentTask = {
                    ...currentTask,
                    input: `${currentTask.input}\n\n${loopWarning}`,
                };
                loopWarning = undefined;
            }
            try {
                this.recordTrace({
                    id: randomUUID(),
                    agentId: originalConfig.id,
                    taskId: task.id,
                    timestamp: Date.now(),
                    type: 'execution',
                    message: `Execution phase (${this.getLevel(reasoningConfig.execution)})`,
                });
                const execPhaseConfig = this.getPhaseConfig(reasoningConfig, 'execution');
                const enhancedConfig = {
                    ...originalConfig,
                    temperature: execPhaseConfig.temperature,
                    maxTokens: Math.max(originalConfig.maxTokens ?? 2000, execPhaseConfig.maxTokens),
                };
                const result = await this.ralph.execute(() => this.runner.run(enhancedConfig, currentTask), {
                    maxRetries: 1,
                    retryOn: ['timeout', 'rate_limit', 'ECONNREFUSED', 'ETIMEDOUT', 'network'],
                });
                const postExecCtx = await this.pipeline.run('post-execution', {
                    agentId: originalConfig.id,
                    taskId: task.id,
                    task: currentTask,
                    config: originalConfig,
                    result,
                    phase: 'post-execution',
                    metadata: {},
                });
                if (postExecCtx.injectedContext) {
                    loopWarning = postExecCtx.injectedContext;
                }
                const preCompletionCtx = await this.pipeline.run('pre-completion', {
                    agentId: originalConfig.id,
                    taskId: task.id,
                    task: currentTask,
                    config: originalConfig,
                    result,
                    phase: 'pre-completion',
                    metadata: {},
                });
                this.recordTrace({
                    id: randomUUID(),
                    agentId: originalConfig.id,
                    taskId: task.id,
                    timestamp: Date.now(),
                    type: preCompletionCtx.continue ? 'pre-completion:passed' : 'pre-completion:failed',
                    message: `Pre-completion check: ${preCompletionCtx.continue ? 'passed' : 'failed'}`,
                    metadata: { reason: preCompletionCtx.reason },
                });
                if (preCompletionCtx.continue) {
                    const verification = await this.verification.verify(task, result);
                    this.recordTrace({
                        id: randomUUID(),
                        agentId: originalConfig.id,
                        taskId: task.id,
                        timestamp: Date.now(),
                        type: verification.passed ? 'verified' : 'rejected',
                        message: `Verification: score ${verification.score}, passed: ${verification.passed}`,
                        metadata: { score: verification.score, reasons: verification.reasons },
                    });
                    if (!verification.passed && attempts < maxAttempts) {
                        this.logger.info({
                            taskId: task.id,
                            score: verification.score,
                            suggestion: verification.suggestion,
                        }, 'Verification failed, retrying');
                        currentTask = {
                            ...currentTask,
                            input: `${task.input}\n\nPrevious attempt feedback: ${verification.suggestion ?? verification.reasons.join('; ')}`,
                        };
                        continue;
                    }
                    finalResult = result;
                    if (result.status === 'success') {
                        await this.addSuccessToKnowledge(originalConfig.id, task.input, result.output);
                    }
                    return result;
                }
                else {
                    if (attempts < maxAttempts) {
                        currentTask = {
                            ...currentTask,
                            input: `${task.input}\n\n${preCompletionCtx.injectedContext}`,
                        };
                    }
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                this.recordTrace({
                    id: randomUUID(),
                    agentId: originalConfig.id,
                    taskId: task.id,
                    timestamp: Date.now(),
                    type: 'failed',
                    message: `Execution failed: ${message}`,
                });
                if (attempts >= maxAttempts) {
                    await this.addErrorToKnowledge(originalConfig.id, task.input, message);
                    return {
                        taskId: task.id,
                        agentId: originalConfig.id,
                        status: 'failed',
                        output: '',
                        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                        durationMs: 0,
                        attempts,
                        error: message,
                        completedAt: Date.now(),
                    };
                }
            }
        }
        await this.addErrorToKnowledge(originalConfig.id, task.input, 'Max retry attempts exceeded');
        return {
            taskId: task.id,
            agentId: originalConfig.id,
            status: 'failed',
            output: finalResult?.output ?? '',
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            durationMs: 0,
            attempts,
            error: 'Max retry attempts exceeded',
            completedAt: Date.now(),
        };
    }
    async addSuccessToKnowledge(agentId, task, output) {
        if (!this.knowledgeBase)
            return;
        try {
            await this.knowledgeBase.addSuccess(agentId, task, output.slice(0, 500));
            this.logger.debug({ agentId, taskId: task.slice(0, 30) }, 'Success added to knowledge base');
        }
        catch (error) {
            this.logger.warn({ error: error instanceof Error ? error.message : 'Unknown' }, 'Failed to add success to knowledge base');
        }
    }
    async addErrorToKnowledge(agentId, task, error) {
        if (!this.knowledgeBase)
            return;
        try {
            await this.knowledgeBase.addError(agentId, task, error);
            this.logger.debug({ agentId, taskId: task.slice(0, 30) }, 'Error added to knowledge base');
        }
        catch (err) {
            this.logger.warn({ error: err instanceof Error ? err.message : 'Unknown' }, 'Failed to add error to knowledge base');
        }
    }
    getLevel(level) {
        return level;
    }
    getPhaseConfig(reasoningConfig, phase) {
        const level = reasoningConfig[phase];
        return {
            level,
            temperature: this.reasoningBudget.getTemperature(level),
            maxTokens: this.reasoningBudget.getMaxTokens(level, 2000),
        };
    }
    recordTrace(trace) {
        this.traceAnalyzer.record(trace);
    }
    getLoopStats() {
        return this.loopDetector.getStats();
    }
    clearLoops(agentId) {
        this.loopDetector.clear(agentId);
    }
    getTraceReport(agentId) {
        return this.traceAnalyzer.getReport(agentId);
    }
    getTraces(agentId, limit) {
        return this.traceAnalyzer.getTraces(agentId, limit);
    }
    getReasoningBudget() {
        return this.reasoningBudget;
    }
}
//# sourceMappingURL=harness.js.map