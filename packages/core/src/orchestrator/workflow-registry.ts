import * as fs from 'fs';
import * as path from 'path';
import type {
  WorkflowDefinition,
  WorkflowRun,
  WorkflowStepResult,
  WorkflowStatus,
} from './types.js';

const DATA_DIR = './data';

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export class WorkflowRegistry {
  private filePath: string;

  constructor(filePath = `${DATA_DIR}/workflows.json`) {
    this.filePath = filePath;
    ensureDataDir();
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2));
    }
  }

  private loadAll(): WorkflowDefinition[] {
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private saveAll(workflows: WorkflowDefinition[]): void {
    fs.writeFileSync(this.filePath, JSON.stringify(workflows, null, 2));
  }

  create(def: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>): WorkflowDefinition {
    const workflows = this.loadAll();
    const now = Date.now();
    const workflow: WorkflowDefinition = {
      ...def,
      id: this.generateId(def.name),
      createdAt: now,
      updatedAt: now,
    };
    workflows.push(workflow);
    this.saveAll(workflows);
    return workflow;
  }

  private generateId(name: string): string {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existing = this.loadAll().filter((w) => w.id.startsWith(base));
    return existing.length > 0 ? `${base}-${existing.length + 1}` : base;
  }

  get(id: string): WorkflowDefinition | undefined {
    const workflows = this.loadAll();
    return workflows.find((w) => w.id === id);
  }

  list(): WorkflowDefinition[] {
    return this.loadAll();
  }

  update(id: string, partial: Partial<Omit<WorkflowDefinition, 'id' | 'createdAt'>>): WorkflowDefinition | undefined {
    const workflows = this.loadAll();
    const index = workflows.findIndex((w) => w.id === id);
    if (index === -1) return undefined;

    const existing = workflows[index];
    if (!existing) return undefined;

    const updated: WorkflowDefinition = {
      id: existing.id,
      name: partial.name ?? existing.name,
      description: partial.description ?? existing.description,
      pattern: partial.pattern ?? existing.pattern,
      steps: partial.steps ?? existing.steps,
      combinePrompt: partial.combinePrompt !== undefined ? partial.combinePrompt : existing.combinePrompt,
      reviewAgentId: partial.reviewAgentId !== undefined ? partial.reviewAgentId : existing.reviewAgentId,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };

    workflows[index] = updated;
    this.saveAll(workflows);
    return updated;
  }

  remove(id: string): boolean {
    const workflows = this.loadAll();
    const index = workflows.findIndex((w) => w.id === id);
    if (index === -1) return false;
    workflows.splice(index, 1);
    this.saveAll(workflows);
    return true;
  }
}

export class WorkflowRunStore {
  private db: import('better-sqlite3').Database;

  constructor(db: import('better-sqlite3').Database) {
    this.db = db;
    this.initTable();
  }

  private initTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_runs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        status TEXT NOT NULL,
        input TEXT NOT NULL,
        step_results TEXT NOT NULL,
        final_output TEXT,
        error TEXT,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        total_tokens INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);
  }

  save(run: WorkflowRun): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO workflow_runs
      (id, workflow_id, status, input, step_results, final_output, error, started_at, completed_at, total_tokens, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      run.id,
      run.workflowId,
      run.status,
      run.input,
      JSON.stringify(run.stepResults),
      run.finalOutput ?? null,
      run.error ?? null,
      run.startedAt,
      run.completedAt ?? null,
      run.totalTokens,
      run.startedAt
    );
  }

  get(id: string): WorkflowRun | undefined {
    const row = this.db.prepare('SELECT * FROM workflow_runs WHERE id = ?').get(id) as {
      id: string;
      workflow_id: string;
      status: WorkflowStatus;
      input: string;
      step_results: string;
      final_output: string | null;
      error: string | null;
      started_at: number;
      completed_at: number | null;
      total_tokens: number;
      created_at: number;
    } | undefined;

    if (!row) return undefined;

    return {
      id: row.id,
      workflowId: row.workflow_id,
      status: row.status,
      input: row.input,
      stepResults: JSON.parse(row.step_results) as Record<string, WorkflowStepResult>,
      finalOutput: row.final_output ?? undefined,
      error: row.error ?? undefined,
      startedAt: row.started_at,
      completedAt: row.completed_at ?? undefined,
      totalTokens: row.total_tokens,
    };
  }

  listByWorkflow(workflowId: string, limit = 20): WorkflowRun[] {
    const rows = this.db.prepare(
      'SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?'
    ).all(workflowId, limit) as Array<{
      id: string;
      workflow_id: string;
      status: WorkflowStatus;
      input: string;
      step_results: string;
      final_output: string | null;
      error: string | null;
      started_at: number;
      completed_at: number | null;
      total_tokens: number;
      created_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      workflowId: row.workflow_id,
      status: row.status,
      input: row.input,
      stepResults: JSON.parse(row.step_results) as Record<string, WorkflowStepResult>,
      finalOutput: row.final_output ?? undefined,
      error: row.error ?? undefined,
      startedAt: row.started_at,
      completedAt: row.completed_at ?? undefined,
      totalTokens: row.total_tokens,
    }));
  }

  listRecent(limit = 50): WorkflowRun[] {
    const rows = this.db.prepare(
      'SELECT * FROM workflow_runs ORDER BY started_at DESC LIMIT ?'
    ).all(limit) as Array<{
      id: string;
      workflow_id: string;
      status: WorkflowStatus;
      input: string;
      step_results: string;
      final_output: string | null;
      error: string | null;
      started_at: number;
      completed_at: number | null;
      total_tokens: number;
      created_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      workflowId: row.workflow_id,
      status: row.status,
      input: row.input,
      stepResults: JSON.parse(row.step_results) as Record<string, WorkflowStepResult>,
      finalOutput: row.final_output ?? undefined,
      error: row.error ?? undefined,
      startedAt: row.started_at,
      completedAt: row.completed_at ?? undefined,
      totalTokens: row.total_tokens,
    }));
  }
}
