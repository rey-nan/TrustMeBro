import pino from 'pino';
import { EmbeddingService } from './embeddings.js';
import type { KnowledgeEntry, KnowledgeType, SearchResult, KnowledgeSearchOptions } from './types.js';
export declare class KnowledgeBase {
    private db;
    private embeddingService;
    private logger;
    constructor(embeddingService: EmbeddingService, dbPath?: string, logger?: pino.Logger);
    private initTables;
    add(entry: Omit<KnowledgeEntry, 'id' | 'embedding' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<KnowledgeEntry>;
    search(query: string, options?: KnowledgeSearchOptions): Promise<SearchResult[]>;
    private textSearch;
    addError(agentId: string, task: string, error: string, solution?: string): Promise<KnowledgeEntry>;
    addSuccess(agentId: string, task: string, approach: string): Promise<KnowledgeEntry>;
    get(id: string): KnowledgeEntry | null;
    list(agentId: string, type?: KnowledgeType): KnowledgeEntry[];
    remove(id: string): void;
    buildContextString(results: SearchResult[]): string;
    getStats(agentId?: string): {
        total: number;
        errors: number;
        successes: number;
        mostUsed: number;
    };
    private rowToEntry;
    private vectorToBlob;
    private blobToVector;
    private enforceMaxEntries;
    close(): void;
}
//# sourceMappingURL=knowledge-base.d.ts.map