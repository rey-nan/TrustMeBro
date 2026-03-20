import pino from 'pino';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { ExecutionTrace } from './types.js';

export class TraceAnalyzer {
  private db: Database.Database;
  private memoryTraces: ExecutionTrace[] = [];
  private logger: pino.Logger;
  private maxMemoryTraces = 100;

  constructor(dbPath: string = './data/trustmebro.db', logger?: pino.Logger) {
    this.logger = logger ?? pino({ name: 'TraceAnalyzer' });

    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initDb();
  }

  private initDb(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS traces (
        id TEXT PRIMARY KEY,
        agentId TEXT NOT NULL,
        taskId TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL,
        message TEXT,
        metadata TEXT
      )
    `);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_traces_agent ON traces(agentId)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_traces_task ON traces(taskId)`);

    this.logger.info({}, 'Trace database initialized');
  }

  record(trace: ExecutionTrace): void {
    this.memoryTraces.push(trace);
    if (this.memoryTraces.length > this.maxMemoryTraces) {
      this.memoryTraces.shift();
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO traces (id, agentId, taskId, timestamp, type, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      trace.id,
      trace.agentId,
      trace.taskId,
      trace.timestamp,
      trace.type,
      trace.message,
      trace.metadata ? JSON.stringify(trace.metadata) : null
    );

    this.logger.debug({
      traceId: trace.id,
      agentId: trace.agentId,
      type: trace.type,
    }, 'Trace recorded');
  }

  analyze(agentId: string): {
    errors: number;
    loops: number;
    avgDuration: number;
    successRate: number;
  } {
    const traces = this.getTracesFromDb(agentId, 100);

    if (traces.length === 0) {
      return { errors: 0, loops: 0, avgDuration: 0, successRate: 0 };
    }

    const errors = traces.filter((t) => t.type === 'failed' || t.type === 'timeout').length;
    const loops = traces.filter((t) => t.type === 'loop_detected').length;
    const successes = traces.filter((t) => t.type === 'success').length;

    const durations = traces
      .filter((t) => t.metadata?.durationMs)
      .map((t) => t.metadata?.durationMs as number);

    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return {
      errors,
      loops,
      avgDuration: Math.round(avgDuration),
      successRate: successes / traces.length,
    };
  }

  getReport(agentId: string): string {
    const stats = this.analyze(agentId);

    return [
      `=== Trace Report for Agent: ${agentId} ===`,
      `Total Traces: ${this.getTraces(agentId).length}`,
      `Success Rate: ${(stats.successRate * 100).toFixed(1)}%`,
      `Errors: ${stats.errors}`,
      `Loops Detected: ${stats.loops}`,
      `Avg Duration: ${(stats.avgDuration / 1000).toFixed(2)}s`,
    ].join('\n');
  }

  getTraces(agentId: string, limit: number = 100): ExecutionTrace[] {
    const memoryFiltered = this.memoryTraces.filter((t) => t.agentId === agentId);
    const dbTraces = this.getTracesFromDb(agentId, limit);

    const combined = [...memoryFiltered, ...dbTraces];
    const seen = new Set<string>();
    const unique = combined.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    return unique.slice(-limit);
  }

  private getTracesFromDb(agentId: string, limit: number): ExecutionTrace[] {
    const stmt = this.db.prepare(`
      SELECT * FROM traces WHERE agentId = ? ORDER BY timestamp DESC LIMIT ?
    `);

    const rows = stmt.all(agentId, limit) as Array<{
      id: string;
      agentId: string;
      taskId: string;
      timestamp: number;
      type: string;
      message: string;
      metadata: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      agentId: row.agentId,
      taskId: row.taskId,
      timestamp: row.timestamp,
      type: row.type as ExecutionTrace['type'],
      message: row.message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  close(): void {
    this.db.close();
  }
}
