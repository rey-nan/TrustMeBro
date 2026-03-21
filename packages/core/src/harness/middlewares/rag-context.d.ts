import pino from 'pino';
import { KnowledgeBase } from '../../knowledge/knowledge-base.js';
import type { Middleware, MiddlewareContext, MiddlewareResult } from '../middleware.js';
export declare class RAGContextMiddleware implements Middleware {
    name: string;
    phase: 'pre-execution';
    private knowledgeBase;
    private logger;
    constructor(knowledgeBase: KnowledgeBase, logger?: pino.Logger);
    execute(ctx: MiddlewareContext): Promise<MiddlewareResult>;
}
//# sourceMappingURL=rag-context.d.ts.map