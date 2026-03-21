import pino from 'pino';
import { LLMClient } from '../llm/index.js';
const DEFAULT_MAX_MESSAGES = 50;
const PROTECTED_MESSAGES = 10;
export class ContextManager {
    history = new Map();
    maxMessages;
    logger;
    constructor(maxMessages = DEFAULT_MAX_MESSAGES, logger) {
        this.maxMessages = maxMessages;
        this.logger = logger ?? pino({ name: 'ContextManager' });
    }
    add(agentId, message) {
        const messages = this.history.get(agentId) ?? [];
        messages.push(message);
        this.history.set(agentId, messages);
        if (messages.length > this.maxMessages) {
            this.compress(agentId, messages);
        }
    }
    get(agentId) {
        return this.history.get(agentId) ?? [];
    }
    clear(agentId) {
        this.history.delete(agentId);
        this.logger.info({ agentId }, 'Context cleared');
    }
    async compress(agentId, messages) {
        if (messages.length <= PROTECTED_MESSAGES)
            return;
        const toSummarize = messages.slice(0, messages.length - PROTECTED_MESSAGES);
        const protectedMessages = messages.slice(-PROTECTED_MESSAGES);
        try {
            const summaryPrompt = `Summarize the following conversation history into a brief summary that preserves all important information:\n\n${toSummarize.map((m) => `${m.role}: ${m.content}`).join('\n\n')}`;
            const client = new LLMClient(this.logger);
            const response = await client.call({
                messages: [{ role: 'user', content: summaryPrompt }],
                maxTokens: 500,
                temperature: 0.3,
            });
            const summarizedMessages = [
                { role: 'system', content: `[Previous conversation summary: ${response.content}]` },
                ...protectedMessages,
            ];
            this.history.set(agentId, summarizedMessages);
            this.logger.info({
                agentId,
                originalMessages: messages.length,
                compressedMessages: summarizedMessages.length,
            }, 'Context compressed');
        }
        catch (error) {
            this.logger.warn({ agentId, error }, 'Context compression failed, keeping all messages');
            this.history.set(agentId, messages.slice(-this.maxMessages));
        }
    }
}
//# sourceMappingURL=context.js.map