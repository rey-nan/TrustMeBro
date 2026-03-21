import pino from 'pino';
import type { AgentRegistry } from './index.js';
export interface Message {
    id: string;
    fromAgentId: string;
    toAgentId: string;
    content: string;
    threadId?: string;
    delivered: boolean;
    read: boolean;
    createdAt: number;
}
export interface Thread {
    id: string;
    title: string;
    taskId?: string;
    participantIds: string[];
    createdAt: number;
    updatedAt: number;
}
export interface Mention {
    id: number;
    mentionedAgentId: string;
    fromAgentId: string;
    messageId: string;
    delivered: boolean;
    createdAt: number;
}
export interface ActivityItem {
    id: string;
    type: 'message_sent' | 'mention' | 'thread_created' | 'task_completed' | 'heartbeat';
    agentId: string;
    content: string;
    metadata?: Record<string, unknown>;
    createdAt: number;
}
export declare class AgentCommunication {
    private db;
    private agentRegistry;
    private emitEvent;
    private logger;
    constructor(agentRegistry: AgentRegistry, basePath?: string, broadcast?: (event: {
        type: string;
        payload: unknown;
        timestamp: number;
    }) => void, logger?: pino.Logger);
    private initTables;
    send(fromAgentId: string, toAgentId: string, content: string, threadId?: string): Message;
    private extractMentions;
    private createMention;
    getInbox(agentId: string): Message[];
    getMentions(agentId: string): Mention[];
    createThread(title: string, participantIds: string[], taskId?: string): Thread;
    postToThread(threadId: string, fromAgentId: string, content: string): Message;
    getThread(threadId: string): {
        thread: Thread;
        messages: Message[];
    } | null;
    getActivityFeed(limit?: number): ActivityItem[];
    broadcast(fromAgentId: string, content: string): void;
    private addActivity;
    addTaskActivity(agentId: string, taskId: string, summary: string): void;
    addHeartbeatActivity(agentId: string, status: string): void;
    getUnreadCount(agentId: string): number;
    close(): void;
}
//# sourceMappingURL=communication.d.ts.map