import pino from 'pino';
import type { SkillRegistry } from '../../skills/registry.js';
import type { Middleware, MiddlewareContext, MiddlewareResult } from '../middleware.js';
export declare class DirectoryContextMiddleware implements Middleware {
    name: string;
    phase: 'pre-execution';
    private workspacePath;
    private skillRegistry;
    private logger;
    constructor(workspacePath: string, skillRegistry?: SkillRegistry, logger?: pino.Logger);
    execute(ctx: MiddlewareContext): Promise<MiddlewareResult>;
    private readFileIfExists;
    private listFiles;
    private extractRecentMemory;
}
//# sourceMappingURL=directory-context.d.ts.map