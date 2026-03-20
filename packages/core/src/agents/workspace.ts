import { mkdirSync, readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';
import pino from 'pino';

const DEFAULT_BASE_PATH = './data/workspaces';

export class AgentWorkspace {
  private agentId: string;
  private basePath: string;
  private workspacePath: string;
  private logger: pino.Logger;

  constructor(agentId: string, basePath?: string) {
    this.agentId = agentId;
    this.basePath = basePath ?? DEFAULT_BASE_PATH;
    this.workspacePath = join(this.basePath, agentId);
    this.logger = pino({ name: `Workspace:${agentId}` });
  }

  async init(): Promise<void> {
    try {
      mkdirSync(join(this.workspacePath, 'daily'), { recursive: true });
      this.logger.info({ path: this.workspacePath }, 'Workspace initialized');

      if (!existsSync(join(this.workspacePath, 'SOUL.md'))) {
        writeFileSync(join(this.workspacePath, 'SOUL.md'), '# Agent SOUL\n\nNot yet defined.', 'utf-8');
      }
      if (!existsSync(join(this.workspacePath, 'WORKING.md'))) {
        writeFileSync(join(this.workspacePath, 'WORKING.md'), '# Current Work\n\n---\n\n', 'utf-8');
      }
      if (!existsSync(join(this.workspacePath, 'MEMORY.md'))) {
        writeFileSync(join(this.workspacePath, 'MEMORY.md'), '# Memory\n\n## Entries\n\n', 'utf-8');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ error: message }, 'Failed to initialize workspace');
      throw error;
    }
  }

  readSOUL(): string {
    const path = join(this.workspacePath, 'SOUL.md');
    if (!existsSync(path)) {
      return '';
    }
    return readFileSync(path, 'utf-8');
  }

  updateSOUL(content: string): void {
    const path = join(this.workspacePath, 'SOUL.md');
    writeFileSync(path, content, 'utf-8');
    this.logger.debug({}, 'SOUL updated');
  }

  updateWorking(content: string): void {
    const path = join(this.workspacePath, 'WORKING.md');
    writeFileSync(path, content, 'utf-8');
    this.logger.debug({}, 'Working file updated');
  }

  readWorking(): string {
    const path = join(this.workspacePath, 'WORKING.md');
    if (!existsSync(path)) {
      return '';
    }
    return readFileSync(path, 'utf-8');
  }

  addMemory(entry: string): void {
    const path = join(this.workspacePath, 'MEMORY.md');
    const timestamp = new Date().toISOString();
    const formattedEntry = `\n### ${timestamp}\n${entry}\n`;
    appendFileSync(path, formattedEntry, 'utf-8');
    this.logger.debug({}, 'Memory entry added');
  }

  readMemory(): string {
    const path = join(this.workspacePath, 'MEMORY.md');
    if (!existsSync(path)) {
      return '';
    }
    return readFileSync(path, 'utf-8');
  }

  logDaily(entry: string): void {
    const today = new Date().toISOString().split('T')[0];
    const path = join(this.workspacePath, 'daily', `${today}.md`);
    const timestamp = new Date().toISOString();
    const formattedEntry = `\n## ${timestamp}\n${entry}\n`;

    if (!existsSync(path)) {
      writeFileSync(path, `# Daily Log - ${today}\n\n---\n`, 'utf-8');
    }
    appendFileSync(path, formattedEntry, 'utf-8');
    this.logger.debug({ date: today }, 'Daily log entry added');
  }

  getContext(): string {
    const working = this.readWorking();
    const memory = this.readMemory();

    const memoryLines = memory.split('\n').filter((line) => line.trim().startsWith('### '));
    const recentMemory = memoryLines.slice(-5).join('\n');

    const parts: string[] = [];
    if (working) {
      parts.push('## Current Work', working, '');
    }
    if (recentMemory) {
      parts.push('## Recent Memory', recentMemory);
    }

    return parts.join('\n');
  }

  getPath(): string {
    return this.workspacePath;
  }
}
