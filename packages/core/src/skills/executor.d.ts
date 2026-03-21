import pino from 'pino';
import type { ToolInput, ToolOutput } from './types.js';
import type { SkillRegistry } from './registry.js';
interface ParsedToolCall {
    tool: string;
    input: ToolInput;
}
export declare class ToolExecutor {
    private registry;
    private logger;
    private readonly timeoutMs;
    private readonly maxToolRounds;
    constructor(registry: SkillRegistry, logger?: pino.Logger);
    parseToolCalls(text: string): ParsedToolCall[];
    execute(toolName: string, input: ToolInput, skillIds: string[]): Promise<ToolOutput>;
    private executeWithTimeout;
    executeAll(text: string, skillIds: string[]): Promise<string>;
    hasToolCalls(text: string): boolean;
}
export {};
//# sourceMappingURL=executor.d.ts.map