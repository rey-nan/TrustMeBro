export type AgentStatus = 'idle' | 'running' | 'success' | 'failed' | 'timeout';
export interface AgentSOUL {
    name: string;
    role: string;
    personality: string;
    expertise: string[];
    workStyle: string;
    values: string[];
    communicationStyle: string;
    limitations: string[];
}
export interface Department {
    id: string;
    name: string;
    description: string;
    color: string;
    agentIds: string[];
    leadAgentId?: string;
    parentDeptId?: string;
    createdAt: number;
}
export interface Organization {
    id: string;
    name: string;
    description: string;
    ceoAgentId?: string;
    departments: Department[];
    createdAt: number;
}
export interface AgentConfig {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    maxRetries?: number;
    soul?: AgentSOUL;
    departmentId?: string;
    level?: 'intern' | 'specialist' | 'lead';
    heartbeatCron?: string;
    workspacePath?: string;
    skillIds?: string[];
}
export interface AgentTask {
    id: string;
    agentId: string;
    input: string;
    context?: Record<string, unknown>;
    priority?: 'low' | 'normal' | 'high';
    createdAt: number;
}
export interface AgentResult {
    taskId: string;
    agentId: string;
    status: AgentStatus;
    output: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
    durationMs: number;
    attempts: number;
    error?: string;
    completedAt: number;
}
//# sourceMappingURL=types.d.ts.map