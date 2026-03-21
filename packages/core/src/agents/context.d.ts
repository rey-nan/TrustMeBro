import pino from 'pino';
import { LLMMessage } from '../llm/index.js';
export declare class ContextManager {
    private history;
    private maxMessages;
    private logger;
    constructor(maxMessages?: number, logger?: pino.Logger);
    add(agentId: string, message: LLMMessage): void;
    get(agentId: string): LLMMessage[];
    clear(agentId: string): void;
    private compress;
}
//# sourceMappingURL=context.d.ts.map