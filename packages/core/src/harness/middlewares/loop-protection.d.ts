import pino from 'pino';
import type { Middleware, MiddlewareContext, MiddlewareResult } from '../middleware.js';
export declare class LoopProtectionMiddleware implements Middleware {
    name: string;
    phase: 'post-execution';
    private maxEditsPerResource;
    private editCounts;
    private logger;
    constructor(maxEditsPerResource?: number, logger?: pino.Logger);
    execute(ctx: MiddlewareContext): Promise<MiddlewareResult>;
    private extractFilesFromOutput;
    getEditCount(agentId: string, resource: string): number;
    clearAgent(agentId: string): void;
    clearAll(): void;
}
//# sourceMappingURL=loop-protection.d.ts.map