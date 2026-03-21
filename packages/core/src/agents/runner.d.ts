import pino from 'pino';
import { LLMClient } from '../llm/index.js';
import { AgentConfig, AgentTask, AgentResult } from './types.js';
import { ContextManager } from './context.js';
import type { AgentCommunication } from './communication.js';
import type { ToolExecutor } from '../skills/executor.js';
export declare class AgentRunner {
    private client;
    private context;
    private communication;
    private toolExecutor;
    private runningTasks;
    private logger;
    constructor(client: LLMClient, context: ContextManager, logger?: pino.Logger);
    setCommunication(communication: AgentCommunication): void;
    setToolExecutor(executor: ToolExecutor): void;
    run(config: AgentConfig, task: AgentTask): Promise<AgentResult>;
    private executeToolCallsWithLLM;
    private executeWithTimeout;
    private extractMentions;
    abort(taskId: string): boolean;
    private sleep;
}
//# sourceMappingURL=runner.d.ts.map