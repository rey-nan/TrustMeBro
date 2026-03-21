import pino from 'pino';
import type { Harness, AgentRegistry, AgentCommunication, KnowledgeBase } from '../index.js';
import type { WorkflowDefinition, WorkflowRun, WorkflowEvent } from './types.js';
type EventEmitter = (event: WorkflowEvent) => void;
export declare class WorkflowEngine {
    private harness;
    private agentRegistry;
    private communication;
    private knowledgeBase;
    private logger;
    private emit;
    constructor(harness: Harness, agentRegistry: AgentRegistry, communication: AgentCommunication, knowledgeBase: KnowledgeBase | null, emit: EventEmitter, logger?: pino.Logger);
    run(definition: WorkflowDefinition, input: string): Promise<WorkflowRun>;
    private runPipeline;
    private runFanOut;
    private runSwarm;
    private simpleVerify;
    private runReview;
    private executeReview;
    private executeStep;
    private interpolateInput;
    private checkCondition;
}
export {};
//# sourceMappingURL=workflow-engine.d.ts.map