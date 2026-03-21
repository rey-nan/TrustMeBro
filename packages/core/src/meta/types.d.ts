export interface MetaAgentConfig {
    model: string;
    provider: string;
    apiKey?: string;
    baseUrl?: string;
    maxTurns: number;
    verbose: boolean;
}
export interface MetaAction {
    type: 'api_call' | 'response' | 'error';
    method?: string;
    endpoint?: string;
    body?: unknown;
    result?: unknown;
    message?: string;
}
export interface MetaConversation {
    id: string;
    messages: MetaMessage[];
    actions: MetaAction[];
    createdAt: number;
    updatedAt: number;
}
export interface MetaMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}
export interface MetaResponse {
    conversationId: string;
    message: string;
    actions: MetaAction[];
    tokensUsed: number;
}
//# sourceMappingURL=types.d.ts.map