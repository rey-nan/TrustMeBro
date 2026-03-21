import type { MetaAgentConfig, MetaConversation, MetaResponse } from './types.js';
export declare class MetaAgent {
    private config;
    private apiBaseUrl;
    private conversations;
    private dataPath;
    constructor(config: MetaAgentConfig, apiBaseUrl?: string);
    private loadConversations;
    private saveConversations;
    private getOrCreateConversation;
    private parseApiCalls;
    private executeApiCall;
    private callLLM;
    chat(userMessage: string, conversationId?: string): Promise<MetaResponse>;
    getConversation(id: string): MetaConversation | undefined;
    listConversations(): MetaConversation[];
    deleteConversation(id: string): boolean;
}
//# sourceMappingURL=meta-agent.d.ts.map