import pino from 'pino';
import { LLMClient } from '../../llm/index.js';
import type { Middleware, MiddlewareContext, MiddlewareResult } from '../middleware.js';
export declare class PreCompletionMiddleware implements Middleware {
    name: string;
    phase: 'pre-completion';
    private llmClient;
    private logger;
    constructor(llmClient: LLMClient, logger?: pino.Logger);
    execute(ctx: MiddlewareContext): Promise<MiddlewareResult>;
    private detectTaskType;
    private checkBasicEvidence;
    private verifyWithLLM;
    private buildVerificationPrompt;
    private parseVerificationResponse;
}
//# sourceMappingURL=pre-completion.d.ts.map