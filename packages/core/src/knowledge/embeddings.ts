import { LLMClient, type LLMRequest } from '../llm/index.js';
import pino from 'pino';

export class EmbeddingService {
  private llmClient: LLMClient;
  private logger: pino.Logger;
  private useApiEmbeddings: boolean;
  private embeddingModel: string;

  constructor(llmClient: LLMClient, logger?: pino.Logger) {
    this.llmClient = llmClient;
    this.logger = logger ?? pino({ name: 'EmbeddingService' });

    const provider = llmClient.getCurrentProvider();
    this.useApiEmbeddings = provider === 'openrouter' || provider === 'openai-compatible';
    this.embeddingModel = 'text-embedding-3-small';
  }

  async embed(text: string): Promise<number[]> {
    if (this.useApiEmbeddings) {
      try {
        return await this.embedViaApi(text);
      } catch (error) {
        this.logger.warn({ error: error instanceof Error ? error.message : 'Unknown' }, 'API embedding failed, using TF-IDF fallback');
      }
    }

    return this.tfidfEmbedding(text);
  }

  private async embedViaApi(text: string): Promise<number[]> {
    const request: LLMRequest = {
      messages: [
        {
          role: 'user',
          content: `Generate a 1536-dimensional embedding for the following text. Return ONLY a JSON array of numbers, nothing else.\n\nText: ${text.slice(0, 8000)}`,
        },
      ],
      model: this.embeddingModel,
      temperature: 0,
      maxTokens: 100,
    };

    const response = await this.llmClient.call(request);

    const content = response.content.trim();
    let embedding: number[];

    try {
      embedding = JSON.parse(content);
    } catch {
      throw new Error('Failed to parse embedding response');
    }

    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Invalid embedding format');
    }

    return this.normalizeVector(embedding);
  }

  private tfidfEmbedding(text: string): number[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const wordFreq = new Map<string, number>();
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
    }

    const maxFreq = Math.max(...wordFreq.values());
    const uniqueWords = [...new Set(words)].slice(0, 384);
    const vector: number[] = [];

    for (const word of uniqueWords) {
      const tf = (wordFreq.get(word) ?? 0) / maxFreq;
      const idf = Math.log((words.length + 1) / ((wordFreq.get(word) ?? 0) + 1));
      vector.push(tf * idf);
    }

    while (vector.length < 384) {
      vector.push(0);
    }

    return this.normalizeVector(vector.slice(0, 384));
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude === 0) return vector;
    return vector.map((v) => v / magnitude);
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      const minLen = Math.min(a.length, b.length);
      a = a.slice(0, minLen);
      b = b.slice(0, minLen);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] ?? 0;
      const bVal = b[i] ?? 0;
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return (dotProduct + 1) / 2;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      try {
        const embedding = await this.embed(text);
        embeddings.push(embedding);
        await this.delay(100);
      } catch (error) {
        this.logger.warn({ error: error instanceof Error ? error.message : 'Unknown' }, `Failed to embed text: ${text.slice(0, 50)}`);
        embeddings.push(new Array(384).fill(0));
      }
    }

    return embeddings;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
