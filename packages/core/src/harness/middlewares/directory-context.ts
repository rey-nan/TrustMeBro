import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import pino from 'pino';
import type { SkillRegistry } from '../../skills/registry.js';
import type { Middleware, MiddlewareContext, MiddlewareResult } from '../middleware.js';

export class DirectoryContextMiddleware implements Middleware {
  name = 'directory-context';
  phase: 'pre-execution' = 'pre-execution';
  private workspacePath: string;
  private skillRegistry: SkillRegistry | null = null;
  private logger: pino.Logger;

  constructor(workspacePath: string, skillRegistry?: SkillRegistry, logger?: pino.Logger) {
    this.workspacePath = workspacePath;
    this.skillRegistry = skillRegistry ?? null;
    this.logger = logger ?? pino({ name: 'DirectoryContextMiddleware' });
  }

  async execute(ctx: MiddlewareContext): Promise<MiddlewareResult> {
    const injectedContexts: string[] = [];

    const agentWorkspace = ctx.config.workspacePath ?? this.workspacePath;
    
    if (!agentWorkspace || !existsSync(agentWorkspace)) {
      return { continue: true };
    }

    try {
      const soulContent = this.readFileIfExists(join(agentWorkspace, 'SOUL.md'));
      if (soulContent) {
        injectedContexts.push(`AGENT SOUL:\n${soulContent}`);
      }

      const workingContent = this.readFileIfExists(join(agentWorkspace, 'WORKING.md'));
      const memoryContent = this.readFileIfExists(join(agentWorkspace, 'MEMORY.md'));

      let envContext = 'AGENT ENVIRONMENT:\n';
      envContext += `Workspace: ${agentWorkspace}\n`;

      const files = this.listFiles(agentWorkspace);
      if (files.length > 0) {
        envContext += `Available files: ${files.join(', ')}\n`;
      }

      if (workingContent) {
        envContext += `\nCurrent task state (WORKING.md):\n${workingContent}\n`;
      }

      if (memoryContent) {
        const recentMemory = this.extractRecentMemory(memoryContent, 3);
        if (recentMemory) {
          envContext += `\nRelevant memory (last 3 entries):\n${recentMemory}\n`;
        }
      }

      injectedContexts.push(envContext);

      if (this.skillRegistry && ctx.config.skillIds && ctx.config.skillIds.length > 0) {
        const toolsContext = this.skillRegistry.buildToolsContext(ctx.config.skillIds);
        if (toolsContext) {
          injectedContexts.push(toolsContext);
        }
      }

      this.logger.info({ agentId: ctx.agentId, workspace: agentWorkspace }, 'Directory context injected');

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn({ error: message }, 'Failed to load directory context');
    }

    return {
      continue: true,
      injectedContext: injectedContexts.length > 0 ? injectedContexts.join('\n\n') : undefined,
    };
  }

  private readFileIfExists(path: string): string | null {
    if (existsSync(path)) {
      try {
        return readFileSync(path, 'utf-8');
      } catch {
        return null;
      }
    }
    return null;
  }

  private listFiles(dir: string): string[] {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      return entries
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .slice(0, 50);
    } catch {
      return [];
    }
  }

  private extractRecentMemory(content: string, count: number): string | null {
    const lines = content.split('\n').filter((l) => l.trim());
    const recent = lines.slice(-count * 3);
    return recent.length > 0 ? recent.join('\n') : null;
  }
}
