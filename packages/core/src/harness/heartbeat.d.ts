import pino from 'pino';
import type { AgentRegistry } from '../agents/index.js';
import type { AgentCommunication } from '../agents/communication.js';
import type { Harness } from './harness.js';
import type { AgentWorkspace } from '../agents/workspace.js';
export interface WsMessage {
    type: string;
    payload: unknown;
    timestamp: number;
}
export interface HeartbeatStatus {
    agentId: string;
    cronExpression: string;
    lastWakeAt?: number;
    lastStatus?: 'ok' | 'worked' | 'error';
    nextWakeAt?: number;
    isActive: boolean;
    consecutiveErrors: number;
}
export declare class HeartbeatSystem {
    private agentRegistry;
    private harness;
    private createWorkspace;
    private communication;
    private broadcast;
    private jobs;
    private status;
    private logger;
    constructor(agentRegistry: AgentRegistry, harness: Harness, createWorkspace: (agentId: string) => AgentWorkspace, broadcast?: (message: WsMessage) => void, logger?: pino.Logger);
    setCommunication(communication: AgentCommunication): void;
    register(agentId: string, cronExpression: string): boolean;
    unregister(agentId: string): boolean;
    start(): void;
    stop(): void;
    wakeAgent(agentId: string): Promise<void>;
    wakeNow(agentId: string): boolean;
    getStatus(): HeartbeatStatus[];
    private calculateNextWake;
    private loadRecords;
    private load;
    private save;
}
//# sourceMappingURL=heartbeat.d.ts.map