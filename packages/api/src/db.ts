import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

const DB_PATH = process.env.DB_PATH ?? './data/trustmebro.db';
const absolutePath = resolve(DB_PATH);

const dir = dirname(absolutePath);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

export const db: DatabaseType = new Database(absolutePath);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    input TEXT NOT NULL,
    status TEXT NOT NULL,
    output TEXT,
    error TEXT,
    attempts INTEGER DEFAULT 0,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    model TEXT,
    temperature REAL,
    max_tokens INTEGER,
    timeout_ms INTEGER,
    max_retries INTEGER,
    soul TEXT,
    department_id TEXT,
    level TEXT DEFAULT 'specialist',
    heartbeat_cron TEXT,
    workspace_path TEXT,
    created_at INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS consumption (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    provider TEXT NOT NULL,
    task_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_consumption_agent ON consumption(agent_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_consumption_created ON consumption(created_at)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#00ff88',
    lead_agent_id TEXT,
    parent_dept_id TEXT,
    created_at INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS agent_departments (
    agent_id TEXT NOT NULL,
    department_id TEXT NOT NULL,
    PRIMARY KEY (agent_id, department_id)
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_depts_agent ON agent_departments(agent_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_depts_dept ON agent_departments(department_id)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS heartbeat_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    status TEXT NOT NULL,
    summary TEXT,
    tokens_used INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_heartbeat_logs_agent ON heartbeat_logs(agent_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_heartbeat_logs_created ON heartbeat_logs(created_at)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sandbox_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT,
    language TEXT NOT NULL,
    code_preview TEXT NOT NULL,
    exit_code INTEGER NOT NULL,
    success INTEGER NOT NULL,
    timed_out INTEGER DEFAULT 0,
    duration_ms INTEGER NOT NULL,
    stdout_preview TEXT,
    stderr_preview TEXT,
    created_at INTEGER NOT NULL
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_sandbox_executions_agent ON sandbox_executions(agent_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sandbox_executions_created ON sandbox_executions(created_at)`);
