import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import type { Skill, Tool, ToolInput, ToolOutput, ToolDefinition } from '../types.js';

const execAsync = promisify(exec);
const logger = pino({ name: 'GitSkill' });

function validatePath(p: string): boolean {
  return !p.includes('..') && !path.isAbsolute(p);
}

export class GitSkill implements Skill {
  id = 'git';
  name = 'Git';
  description = 'Git operations: clone, pull, run commands, check status';
  tools: Tool[];

  constructor(private workspaceRoot: string = './data/workspaces') {
    this.tools = [
      this.createCloneTool(),
      this.createPullTool(),
      this.createRunTool(),
      this.createStatusTool(),
    ];
  }

  private getWorkspacePath(agentId: string): string {
    return path.resolve(this.workspaceRoot, agentId);
  }

  private createCloneTool(): Tool {
    const definition: ToolDefinition = {
      name: 'git_clone',
      description: 'Clone a git repository into the agent workspace',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Git repository URL to clone', required: true },
          targetDir: { type: 'string', description: 'Target directory relative to workspace (optional)' },
          agentId: { type: 'string', description: 'Agent ID for workspace path', required: true },
        },
        required: ['url', 'agentId'],
      },
    };

    return {
      definition,
      execute: async (input: ToolInput): Promise<ToolOutput> => {
        try {
          const { url, targetDir, agentId } = input as { url: string; targetDir?: string; agentId: string };
          const workspace = this.getWorkspacePath(agentId);

          if (!fs.existsSync(workspace)) {
            fs.mkdirSync(workspace, { recursive: true });
          }

          const target = targetDir ? path.join(workspace, targetDir) : workspace;
          
          if (targetDir && !validatePath(targetDir)) {
            return { success: false, error: 'Invalid path: path traversal not allowed' };
          }

          logger.info({ url, target }, 'Cloning repository');

          const { stdout, stderr } = await execAsync(`git clone "${url}" "${target}"`, {
            timeout: 60000,
          });

          return {
            success: true,
            result: { path: targetDir || path.basename(url, '.git'), message: 'Repository cloned successfully' },
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Clone failed';
          logger.error({ error: msg }, 'Git clone failed');
          return { success: false, error: msg };
        }
      },
    };
  }

  private createPullTool(): Tool {
    const definition: ToolDefinition = {
      name: 'git_pull',
      description: 'Pull latest changes from a cloned repository',
      inputSchema: {
        type: 'object',
        properties: {
          repoDir: { type: 'string', description: 'Repository directory relative to workspace', required: true },
          agentId: { type: 'string', description: 'Agent ID for workspace path', required: true },
        },
        required: ['repoDir', 'agentId'],
      },
    };

    return {
      definition,
      execute: async (input: ToolInput): Promise<ToolOutput> => {
        try {
          const { repoDir, agentId } = input as { repoDir: string; agentId: string };
          
          if (!validatePath(repoDir)) {
            return { success: false, error: 'Invalid path: path traversal not allowed' };
          }

          const workspace = this.getWorkspacePath(agentId);
          const repoPath = path.join(workspace, repoDir);

          if (!fs.existsSync(repoPath)) {
            return { success: false, error: `Repository not found: ${repoDir}` };
          }

          logger.info({ repoPath }, 'Pulling repository');

          const { stdout } = await execAsync('git pull', {
            cwd: repoPath,
            timeout: 60000,
          });

          return {
            success: true,
            result: { message: stdout.trim(), changes: !stdout.includes('Already up to date') },
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Pull failed';
          return { success: false, error: msg };
        }
      },
    };
  }

  private createRunTool(): Tool {
    const definition: ToolDefinition = {
      name: 'git_run',
      description: 'Run a command inside a cloned repository',
      inputSchema: {
        type: 'object',
        properties: {
          repoDir: { type: 'string', description: 'Repository directory relative to workspace', required: true },
          command: { type: 'string', description: 'Command to run', required: true },
          args: { type: 'array', description: 'Command arguments' },
          agentId: { type: 'string', description: 'Agent ID for workspace path', required: true },
        },
        required: ['repoDir', 'command', 'agentId'],
      },
    };

    return {
      definition,
      execute: async (input: ToolInput): Promise<ToolOutput> => {
        try {
          const { repoDir, command, args = [], agentId } = input as {
            repoDir: string;
            command: string;
            args?: string[];
            agentId: string;
          };

          if (!validatePath(repoDir)) {
            return { success: false, error: 'Invalid path: path traversal not allowed' };
          }

          const workspace = this.getWorkspacePath(agentId);
          const repoPath = path.join(workspace, repoDir);

          if (!fs.existsSync(repoPath)) {
            return { success: false, error: `Repository not found: ${repoDir}` };
          }

          const fullCommand = `${command} ${args.map(a => `"${a}"`).join(' ')}`;
          logger.info({ repoPath, command: fullCommand }, 'Running command in repo');

          try {
            const { stdout, stderr } = await execAsync(fullCommand, {
              cwd: repoPath,
              timeout: 60000,
            });

            return {
              success: true,
              result: { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 },
            };
          } catch (execError: any) {
            return {
              success: false,
              result: {
                stdout: execError.stdout?.trim() || '',
                stderr: execError.stderr?.trim() || '',
                exitCode: execError.code || 1,
              },
              error: execError.message,
            };
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Run failed';
          return { success: false, error: msg };
        }
      },
    };
  }

  private createStatusTool(): Tool {
    const definition: ToolDefinition = {
      name: 'git_status',
      description: 'List cloned repositories in the workspace',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Agent ID for workspace path', required: true },
        },
        required: ['agentId'],
      },
    };

    return {
      definition,
      execute: async (input: ToolInput): Promise<ToolOutput> => {
        try {
          const { agentId } = input as { agentId: string };
          const workspace = this.getWorkspacePath(agentId);

          if (!fs.existsSync(workspace)) {
            return { success: true, result: { repos: [] } };
          }

          const entries = fs.readdirSync(workspace, { withFileTypes: true });
          const repos = entries
            .filter(e => e.isDirectory())
            .map(e => {
              const gitPath = path.join(workspace, e.name, '.git');
              if (fs.existsSync(gitPath)) {
                const stats = fs.statSync(path.join(workspace, e.name));
                return {
                  name: e.name,
                  path: e.name,
                  lastUpdated: stats.mtimeMs,
                };
              }
              return null;
            })
            .filter(Boolean);

          return { success: true, result: { repos } };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Status failed';
          return { success: false, error: msg };
        }
      },
    };
  }
}
