import pino from 'pino';
import { LLMClient } from '../llm/index.js';
import { AgentRunner, AgentConfig, AgentTask, AgentResult } from '../agents/index.js';
import { KnowledgeBase } from '../knowledge/knowledge-base.js';
import { ReasoningBudget } from './reasoning-budget.js';
import type { HarnessConfig, ExecutionTrace } from './types.js';
export declare class Harness {
    private client;
    private runner;
    private config;
    private verification;
    private loopDetector;
    private traceAnalyzer;
    private ralph;
    private pipeline;
    private loopProtection;
    private reasoningBudget;
    private knowledgeBase;
    private logger;
    constructor(client: LLMClient, runner: AgentRunner, config: HarnessConfig, logger?: pino.Logger);
    setKnowledgeBase(kb: KnowledgeBase): void;
    private setupMiddleware;
    execute(originalConfig: AgentConfig, task: AgentTask): Promise<AgentResult>;
    private addSuccessToKnowledge;
    private addErrorToKnowledge;
    private getLevel;
    private getPhaseConfig;
    private recordTrace;
    getLoopStats(): import("./types.js").LoopRecord[];
    clearLoops(agentId?: string): void;
    getTraceReport(agentId: string): string;
    getTraces(agentId: string, limit?: number): ExecutionTrace[];
    getReasoningBudget(): ReasoningBudget;
}
//# sourceMappingURL=harness.d.ts.map