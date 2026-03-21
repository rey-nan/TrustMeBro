import pino from 'pino';
import type { AgentConfig, AgentTask, AgentResult } from '../agents/index.js';
export type MiddlewarePhase = 'pre-execution' | 'post-execution' | 'pre-completion';
export interface MiddlewareContext {
    agentId: string;
    taskId: string;
    task: AgentTask;
    config: AgentConfig;
    result?: AgentResult;
    phase: MiddlewarePhase;
    metadata: Record<string, unknown>;
}
export interface MiddlewareResult {
    continue: boolean;
    modifiedResult?: AgentResult;
    injectedContext?: string;
    reason?: string;
}
export interface Middleware {
    name: string;
    phase: MiddlewarePhase;
    execute(ctx: MiddlewareContext): Promise<MiddlewareResult>;
}
export declare class MiddlewarePipeline {
    private middlewares;
    private logger;
    constructor(logger?: pino.Logger);
    use(middleware: Middleware): void;
    run(phase: MiddlewarePhase, ctx: MiddlewareContext): Promise<MiddlewareResult>;
    getMiddlewareCount(): number;
    listMiddlewares(): Array<{
        name: string;
        phase: MiddlewarePhase;
    }>;
}
//# sourceMappingURL=middleware.d.ts.map