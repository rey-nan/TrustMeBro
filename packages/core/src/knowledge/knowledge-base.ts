import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import pino from 'pino';
import Database from 'better-sqlite3';
import { EmbeddingService } from './embeddings.js';
import type {
  KnowledgeEntry,
  KnowledgeType,
  SearchResult,
  KnowledgeSearchOptions,
} from './types.js';

const MAX_ENTRIES_PER_AGENT = 10000;

export class KnowledgeBase {
  private db: Database.Database;
  private embeddingService: EmbeddingService;
  private logger: pino.Logger;

  constructor(embeddingService: EmbeddingService, dbPath: string = './data/knowledge.db', logger?: pino.Logger) {
    this.embeddingService = embeddingService;
    this.logger = logger ?? pino({ name: 'KnowledgeBase' });

    if (!existsSync(dbPath)) {
      const dir = join(dbPath, '..');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(dbPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        embedding BLOB,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        usage_count INTEGER DEFAULT 0
      )
    `);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_knowledge_agent ON knowledge(agent_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type)`);
  }

  async add(
    entry: Omit<KnowledgeEntry, 'id' | 'embedding' | 'createdAt' | 'updatedAt' | 'usageCount'>
  ): Promise<KnowledgeEntry> {
    const id = randomUUID();
    const now = Date.now();

    const textToEmbed = `${entry.title} ${entry.content}`;
    let embedding: number[] | undefined;

    try {
      embedding = await this.embeddingService.embed(textToEmbed);
    } catch (error) {
      this.logger.warn({ error: error instanceof Error ? error.message : 'Unknown' }, 'Failed to generate embedding');
    }

    const embeddingBlob = embedding ? this.vectorToBlob(embedding) : null;

    this.db.prepare(`
      INSERT INTO knowledge (id, agent_id, type, title, content, tags, embedding, created_at, updated_at, usage_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(id, entry.agentId, entry.type, entry.title, entry.content, JSON.stringify(entry.tags), embeddingBlob, now, now);

    this.enforceMaxEntries(entry.agentId);

    this.logger.info({ id, agentId: entry.agentId, type: entry.type }, 'Knowledge entry added');

    return {
      id,
      agentId: entry.agentId,
      type: entry.type,
      title: entry.title,
      content: entry.content,
      tags: entry.tags,
      embedding,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
    };
  }

  async search(query: string, options: KnowledgeSearchOptions = {}): Promise<SearchResult[]> {
    const limit = options.limit ?? 5;
    const minScore = options.minScore ?? 0.5;

    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.embeddingService.embed(query);
    } catch (error) {
      this.logger.warn('Embedding generation failed, falling back to text search');
      return this.textSearch(query, options);
    }

    const agentCondition = options.agentId
      ? `agent_id = ?`
      : `(agent_id = 'global' OR agent_id = ?)`;

    const params: (string | number)[] = [];

    if (options.agentId) {
      params.push(options.agentId);
    }

    if (options.types && options.types.length > 0) {
      params.push(options.types.join("','"));
    }

    let sql = `
      SELECT id, agent_id, type, title, content, tags, embedding, created_at, updated_at, usage_count
      FROM knowledge
      WHERE ${agentCondition}
    `;

    if (options.types && options.types.length > 0) {
      sql += ` AND type IN ('${options.types.join("','")}')`;
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      agent_id: string;
      type: string;
      title: string;
      content: string;
      tags: string;
      embedding: Buffer | null;
      created_at: number;
      updated_at: number;
      usage_count: number;
    }>;

    const results: SearchResult[] = [];

    for (const row of rows) {
      const entry = this.rowToEntry(row);

      if (!entry.embedding || entry.embedding.length === 0) {
        continue;
      }

      const score = this.embeddingService.cosineSimilarity(queryEmbedding, entry.embedding);

      if (score >= minScore) {
        results.push({
          entry: { ...entry, relevanceScore: score },
          score,
        });

        this.db.prepare(`UPDATE knowledge SET usage_count = usage_count + 1 WHERE id = ?`).run(entry.id);
      }
    }

    results.sort((a, b) => b.score - a.score);

    this.logger.info({
      query: query.slice(0, 50),
      resultsFound: results.length,
      minScore,
    }, 'Knowledge search completed');

    return results.slice(0, limit);
  }

  private async textSearch(query: string, options: KnowledgeSearchOptions): Promise<SearchResult[]> {
    const limit = options.limit ?? 5;
    const searchTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    const params: string[] = [];
    if (options.agentId) {
      params.push(options.agentId);
    }

    let sql = `
      SELECT id, agent_id, type, title, content, tags, embedding, created_at, updated_at, usage_count
      FROM knowledge
      WHERE (agent_id = 'global' OR agent_id = ?)
    `;

    if (options.types && options.types.length > 0) {
      sql += ` AND type IN ('${options.types.join("','")}')`;
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      agent_id: string;
      type: string;
      title: string;
      content: string;
      tags: string;
      embedding: Buffer | null;
      created_at: number;
      updated_at: number;
      usage_count: number;
    }>;

    const results: SearchResult[] = [];

    for (const row of rows) {
      const entry = this.rowToEntry(row);
      const text = `${entry.title} ${entry.content} ${entry.tags.join(' ')}`.toLowerCase();

      let matchCount = 0;
      for (const term of searchTerms) {
        if (text.includes(term)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const score = matchCount / searchTerms.length;
        results.push({
          entry: { ...entry, relevanceScore: score },
          score,
        });

        this.db.prepare(`UPDATE knowledge SET usage_count = usage_count + 1 WHERE id = ?`).run(entry.id);
      }
    }

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  async addError(
    agentId: string,
    task: string,
    error: string,
    solution?: string
  ): Promise<KnowledgeEntry> {
    const title = `Error: ${task.slice(0, 47)}`;
    const content = `Task: ${task}\nError: ${error}\nSolution: ${solution || 'Unknown'}`;

    return this.add({
      agentId,
      type: 'error',
      title,
      content,
      tags: ['error', 'task-failure'],
    });
  }

  async addSuccess(
    agentId: string,
    task: string,
    approach: string
  ): Promise<KnowledgeEntry> {
    const title = `Success: ${task.slice(0, 47)}`;
    const content = `Task: ${task}\nApproach: ${approach}`;

    return this.add({
      agentId,
      type: 'success',
      title,
      content,
      tags: ['success', 'task-completion'],
    });
  }

  get(id: string): KnowledgeEntry | null {
    const row = this.db.prepare(`SELECT * FROM knowledge WHERE id = ?`).get(id) as {
      id: string;
      agent_id: string;
      type: string;
      title: string;
      content: string;
      tags: string;
      embedding: Buffer | null;
      created_at: number;
      updated_at: number;
      usage_count: number;
    } | undefined;

    if (!row) return null;
    return this.rowToEntry(row);
  }

  list(agentId: string, type?: KnowledgeType): KnowledgeEntry[] {
    let sql = `SELECT * FROM knowledge WHERE agent_id = ?`;
    const params: string[] = [agentId];

    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY updated_at DESC`;

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      agent_id: string;
      type: string;
      title: string;
      content: string;
      tags: string;
      embedding: Buffer | null;
      created_at: number;
      updated_at: number;
      usage_count: number;
    }>;

    return rows.map((row) => this.rowToEntry(row));
  }

  remove(id: string): void {
    this.db.prepare(`DELETE FROM knowledge WHERE id = ?`).run(id);
    this.logger.info({ id }, 'Knowledge entry removed');
  }

  buildContextString(results: SearchResult[]): string {
    if (results.length === 0) return '';

    const parts = ['RELEVANT KNOWLEDGE:', ''];

    for (const { entry, score } of results) {
      const typeLabel = entry.type.toUpperCase();
      const scorePercent = Math.round(score * 100);
      parts.push(`[${typeLabel}] (${scorePercent}% match) Title: ${entry.title}`);
      parts.push(`Content: ${entry.content}`);
      parts.push('');
    }

    return parts.join('\n');
  }

  getStats(agentId?: string): { total: number; errors: number; successes: number; mostUsed: number } {
    const condition = agentId ? `WHERE agent_id = ?` : '';
    const params = agentId ? [agentId] : [];

    const total = (this.db.prepare(`SELECT COUNT(*) as count FROM knowledge ${condition}`).get(...params) as { count: number }).count;
    const errors = (this.db.prepare(`SELECT COUNT(*) as count FROM knowledge ${condition} AND type = 'error'`).get(...params) as { count: number }).count;
    const successes = (this.db.prepare(`SELECT COUNT(*) as count FROM knowledge ${condition} AND type = 'success'`).get(...params) as { count: number }).count;
    const mostUsed = (this.db.prepare(`SELECT MAX(usage_count) as max FROM knowledge ${condition}`).get(...params) as { max: number }).max;

    return { total, errors, successes, mostUsed: mostUsed ?? 0 };
  }

  private rowToEntry(row: {
    id: string;
    agent_id: string;
    type: string;
    title: string;
    content: string;
    tags: string;
    embedding: Buffer | null;
    created_at: number;
    updated_at: number;
    usage_count: number;
  }): KnowledgeEntry {
    return {
      id: row.id,
      agentId: row.agent_id,
      type: row.type as KnowledgeType,
      title: row.title,
      content: row.content,
      tags: JSON.parse(row.tags),
      embedding: row.embedding ? this.blobToVector(row.embedding) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      usageCount: row.usage_count,
    };
  }

  private vectorToBlob(vector: number[]): Buffer {
    const float32 = new Float32Array(vector);
    return Buffer.from(float32.buffer);
  }

  private blobToVector(blob: Buffer): number[] {
    const float32Array = new Float32Array(blob.buffer, blob.byteOffset, blob.length / 4);
    return Array.from(float32Array);
  }

  private enforceMaxEntries(agentId: string): void {
    const count = (this.db.prepare(`SELECT COUNT(*) as count FROM knowledge WHERE agent_id = ?`).get(agentId) as { count: number }).count;

    if (count > MAX_ENTRIES_PER_AGENT) {
      const toDelete = count - MAX_ENTRIES_PER_AGENT;

      this.db.exec(`
        DELETE FROM knowledge
        WHERE id IN (
          SELECT id FROM knowledge
          WHERE agent_id = '${agentId}'
          ORDER BY usage_count ASC, created_at ASC
          LIMIT ${toDelete}
        )
      `);

      this.logger.info({ agentId, deleted: toDelete }, 'Pruned old knowledge entries');
    }
  }

  close(): void {
    this.db.close();
  }
}
