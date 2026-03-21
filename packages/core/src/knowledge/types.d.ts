export type KnowledgeType = 'error' | 'success' | 'skill' | 'document' | 'fact' | 'preference';
export interface KnowledgeEntry {
    id: string;
    agentId: string;
    type: KnowledgeType;
    title: string;
    content: string;
    tags: string[];
    embedding?: number[];
    relevanceScore?: number;
    createdAt: number;
    updatedAt: number;
    usageCount: number;
}
export interface SearchResult {
    entry: KnowledgeEntry;
    score: number;
}
export interface KnowledgeSearchOptions {
    agentId?: string;
    types?: KnowledgeType[];
    limit?: number;
    minScore?: number;
}
//# sourceMappingURL=types.d.ts.map