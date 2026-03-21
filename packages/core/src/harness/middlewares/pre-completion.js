import pino from 'pino';
export class PreCompletionMiddleware {
    name = 'pre-completion-check';
    phase = 'pre-completion';
    llmClient;
    logger;
    constructor(llmClient, logger) {
        this.llmClient = llmClient;
        this.logger = logger ?? pino({ name: 'PreCompletionMiddleware' });
    }
    async execute(ctx) {
        if (!ctx.result) {
            return { continue: true };
        }
        if (ctx.result.status !== 'success') {
            return { continue: true };
        }
        const taskType = this.detectTaskType(ctx.task.input);
        const hasEvidence = this.checkBasicEvidence(ctx.result.output, taskType);
        if (hasEvidence) {
            this.logger.debug({ taskId: ctx.taskId }, 'Task has basic evidence of completion');
            return { continue: true };
        }
        if (taskType === 'general') {
            this.logger.debug({ taskId: ctx.taskId }, 'General task - skipping LLM verification');
            return { continue: true };
        }
        const verification = await this.verifyWithLLM(ctx, taskType);
        this.logger.info({
            taskId: ctx.taskId,
            completed: verification.completed,
            confidence: verification.confidence,
        }, 'Pre-completion verification result');
        if (!verification.completed || verification.confidence < 70) {
            return {
                continue: false,
                injectedContext: `Your previous response was incomplete. ${verification.missing}. ${verification.suggestion}. Try again.`,
                reason: `Verification failed: confidence=${verification.confidence}`,
            };
        }
        return { continue: true };
    }
    detectTaskType(input) {
        const lower = input.toLowerCase();
        if (lower.includes('code') || lower.includes('implement') || lower.includes('function') ||
            lower.includes('file') || lower.includes('write') || lower.includes('create')) {
            return 'code';
        }
        if (lower.includes('research') || lower.includes('find') || lower.includes('search') ||
            lower.includes('analyze') || lower.includes('information')) {
            return 'research';
        }
        return 'general';
    }
    checkBasicEvidence(output, taskType) {
        if (!output || output.trim().length < 3) {
            return false;
        }
        switch (taskType) {
            case 'code':
                return /\.(ts|js|tsx|jsx|py|go|rs|java|cpp)\b|\bfunction\s+\w+|\bclass\s+\w+|\bconst\s+\w+\s*=/.test(output);
            case 'research':
                return /\d+|%|\bdata\b|\bfindings\b|\bconclusion\b/i.test(output);
            case 'general':
                return output.trim().length >= 10;
        }
    }
    async verifyWithLLM(ctx, taskType) {
        const prompt = this.buildVerificationPrompt(ctx.task.input, ctx.result.output, taskType);
        const request = {
            messages: [{ role: 'user', content: prompt }],
            model: undefined,
            temperature: 0.1,
            maxTokens: 500,
        };
        try {
            const response = await this.llmClient.call(request);
            return this.parseVerificationResponse(response.content);
        }
        catch (error) {
            this.logger.warn({ error: error instanceof Error ? error.message : 'Unknown' }, 'LLM verification failed');
            return {
                completed: true,
                confidence: 50,
                missing: 'Unable to verify',
                suggestion: 'Manual review recommended',
            };
        }
    }
    buildVerificationPrompt(input, output, taskType) {
        const taskTypeHint = {
            code: 'This is a coding task.',
            research: 'This is a research task.',
            general: 'This is a general task.',
        }[taskType];
        return `Task: ${input}

Agent output: ${output.slice(0, 2000)}

${taskTypeHint}

Answer ONLY with valid JSON (no markdown, no explanation):
{
  "completed": true/false,
  "confidence": 0-100,
  "missing": "what is missing if not completed, or empty string",
  "suggestion": "what the agent should do next if not completed, or empty string"
}`;
    }
    parseVerificationResponse(content) {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    completed: Boolean(parsed.completed),
                    confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 0)),
                    missing: String(parsed.missing ?? ''),
                    suggestion: String(parsed.suggestion ?? ''),
                };
            }
        }
        catch {
            this.logger.warn('Failed to parse verification response');
        }
        return {
            completed: true,
            confidence: 50,
            missing: '',
            suggestion: '',
        };
    }
}
//# sourceMappingURL=pre-completion.js.map