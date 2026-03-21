import { LLMClient } from '../llm/index.js';
import pino from 'pino';
export declare class EmbeddingService {
    private llmClient;
    private logger;
    private useApiEmbeddings;
    private embeddingModel;
    constructor(llmClient: LLMClient, logger?: pino.Logger);
    embed(text: string): Promise<number[]>;
    private embedViaApi;
    private tfidfEmbedding;
    private normalizeVector;
    cosineSimilarity(a: number[], b: number[]): number;
    embedBatch(texts: string[]): Promise<number[][]>;
    private delay;
}
//# sourceMappingURL=embeddings.d.ts.map