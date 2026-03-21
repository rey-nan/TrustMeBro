import pino from 'pino';
export class SelfVerification {
    client;
    verificationThreshold;
    logger;
    constructor(client, verificationThreshold = 60, logger) {
        this.client = client;
        this.verificationThreshold = verificationThreshold;
        this.logger = logger ?? pino({ name: 'SelfVerification' });
    }
    async verify(task, result) {
        this.logger.info({ taskId: task.id, agentId: task.agentId }, 'Starting verification');
        const prompt = `You are a task verification system. Evaluate whether the AI agent successfully completed the given task.

Task Input: "${task.input}"
${task.context ? `Context: ${JSON.stringify(task.context)}` : ''}

Agent Output: "${result.output}"

Respond ONLY with valid JSON in this exact format:
{
  "score": <number 0-100>,
  "passed": <boolean>,
  "reasons": ["<reason1>", "<reason2>", ...],
  "suggestion": "<optional improvement suggestion>"
}

Score criteria:
- 90-100: Task fully and excellently completed
- 70-89: Task completed with minor issues
- 50-69: Task partially completed
- 0-49: Task failed or irrelevant response`;
        try {
            const response = await this.client.call({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                maxTokens: 300,
            });
            const parsed = this.parseResponse(response.content);
            const passed = parsed.score >= this.verificationThreshold;
            this.logger.info({
                taskId: task.id,
                score: parsed.score,
                passed,
                threshold: this.verificationThreshold,
            }, 'Verification completed');
            return { ...parsed, passed };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error({ error: message }, 'Verification failed');
            return {
                score: 0,
                passed: false,
                reasons: [`Verification error: ${message}`],
            };
        }
    }
    async verifyPlan(plan) {
        this.logger.info({ planLength: plan.length }, 'Starting plan verification');
        const prompt = `You are a plan evaluation system. Evaluate whether this plan is viable and complete.

Plan:
${plan}

Respond ONLY with valid JSON in this exact format:
{
  "score": <number 0-100>,
  "passed": <boolean>,
  "reasons": ["<reason1>", "<reason2>", ...],
  "suggestion": "<optional improvement suggestion>"
}

Score criteria:
- 90-100: Plan is excellent, complete, and achievable
- 70-89: Plan is good but missing some details
- 50-69: Plan is partially viable
- 0-49: Plan is incomplete, unclear, or not achievable`;
        try {
            const response = await this.client.call({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                maxTokens: 300,
            });
            const parsed = this.parseResponse(response.content);
            const passed = parsed.score >= 70;
            this.logger.info({ score: parsed.score, passed }, 'Plan verification completed');
            return { ...parsed, passed };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error({ error: message }, 'Plan verification failed');
            return {
                score: 0,
                passed: false,
                reasons: [`Verification error: ${message}`],
            };
        }
    }
    parseResponse(content) {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    score: Math.max(0, Math.min(100, parsed.score ?? 0)),
                    reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
                    suggestion: parsed.suggestion,
                };
            }
        }
        catch {
            // Fall through to default
        }
        return {
            score: 0,
            reasons: ['Failed to parse LLM response'],
        };
    }
}
//# sourceMappingURL=verification.js.map