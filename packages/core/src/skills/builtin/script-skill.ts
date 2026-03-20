import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import type { Skill, Tool, ToolInput, ToolOutput, ToolDefinition } from '../types.js';

const execAsync = promisify(exec);
const logger = pino({ name: 'ScriptSkill' });

const BLOCKED_COMMANDS = ['rm -rf /', 'sudo', 'format', 'del /f /s /q C:', 'shutdown', 'reboot'];

function validatePath(p: string): boolean {
  return !p.includes('..') && !path.isAbsolute(p);
}

function isCommandBlocked(command: string): boolean {
  const lower = command.toLowerCase();
  return BLOCKED_COMMANDS.some(blocked => lower.includes(blocked.toLowerCase()));
}

export class ScriptSkill implements Skill {
  id = 'script';
  name = 'Script';
  description = 'Run scripts: bash, node, python';
  tools: Tool[];

  constructor(private workspaceRoot: string = './data/workspaces') {
    this.tools = [
      this.createRunScriptTool(),
      this.createRunNodeTool(),
      this.createRunPythonTool(),
      this.createListScriptsTool(),
    ];
  }

  private getWorkspacePath(agentId: string): string {
    return path.resolve(this.workspaceRoot, agentId);
  }

  private createRunScriptTool(): Tool {
    const definition: ToolDefinition = {
      name: 'run_script',
      description: 'Execute any command in the agent workspace',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to execute', required: true },
          args: { type: 'array', description: 'Command arguments' },
          cwd: { type: 'string', description: 'Working directory relative to workspace' },
          agentId: { type: 'string', description: 'Agent ID for workspace path', required: true },
        },
        required: ['command', 'agentId'],
      },
    };

    return {
      definition,
      execute: async (input: ToolInput): Promise<ToolOutput> => {
        try {
          const { command, args = [], cwd, agentId } = input as {
            command: string;
            args?: string[];
            cwd?: string;
            agentId: string;
          };

          if (isCommandBlocked(command)) {
            return { success: false, error: 'Command blocked for security reasons' };
          }

          const workspace = this.getWorkspacePath(agentId);
          let workDir = workspace;

          if (cwd) {
            if (!validatePath(cwd)) {
              return { success: false, error: 'Invalid path: path traversal not allowed' };
            }
            workDir = path.join(workspace, cwd);
          }

          if (!fs.existsSync(workspace)) {
            fs.mkdirSync(workspace, { recursive: true });
          }

          const fullCommand = `${command} ${args.map(a => `"${a}"`).join(' ')}`;
          logger.info({ command: fullCommand, cwd: workDir }, 'Running script');

          const startTime = Date.now();

          try {
            const { stdout, stderr } = await execAsync(fullCommand, {
              cwd: workDir,
              timeout: 60000,
            });

            return {
              success: true,
              result: {
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: 0,
                durationMs: Date.now() - startTime,
              },
            };
          } catch (execError: any) {
            return {
              success: false,
              result: {
                stdout: execError.stdout?.trim() || '',
                stderr: execError.stderr?.trim() || '',
                exitCode: execError.code || 1,
                durationMs: Date.now() - startTime,
              },
              error: execError.message,
            };
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Script execution failed';
          return { success: false, error: msg };
        }
      },
    };
  }

  private createRunNodeTool(): Tool {
    const definition: ToolDefinition = {
      name: 'run_node',
      description: 'Execute a Node.js script in the agent workspace',
      inputSchema: {
        type: 'object',
        properties: {
          scriptPath: { type: 'string', description: 'Path to script relative to workspace', required: true },
          args: { type: 'array', description: 'Script arguments' },
          agentId: { type: 'string', description: 'Agent ID for workspace path', required: true },
        },
        required: ['scriptPath', 'agentId'],
      },
    };

    return {
      definition,
      execute: async (input: ToolInput): Promise<ToolOutput> => {
        const { scriptPath, args = [], agentId } = input as {
          scriptPath: string;
          args?: string[];
          agentId: string;
        };

        return this.executeScript('node', scriptPath, args, agentId);
      },
    };
  }

  private createRunPythonTool(): Tool {
    const definition: ToolDefinition = {
      name: 'run_python',
      description: 'Execute a Python script in the agent workspace',
      inputSchema: {
        type: 'object',
        properties: {
          scriptPath: { type: 'string', description: 'Path to script relative to workspace', required: true },
          args: { type: 'array', description: 'Script arguments' },
          agentId: { type: 'string', description: 'Agent ID for workspace path', required: true },
        },
        required: ['scriptPath', 'agentId'],
      },
    };

    return {
      definition,
      execute: async (input: ToolInput): Promise<ToolOutput> => {
        const { scriptPath, args = [], agentId } = input as {
          scriptPath: string;
          args?: string[];
          agentId: string;
        };

        return this.executeScript('python', scriptPath, args, agentId);
      },
    };
  }

  private createListScriptsTool(): Tool {
    const definition: ToolDefinition = {
      name: 'list_scripts',
      description: 'List available scripts in the agent workspace',
      inputSchema: {
        type: 'object',
        properties: {
          dir: { type: 'string', description: 'Directory to search relative to workspace' },
          agentId: { type: 'string', description: 'Agent ID for workspace path', required: true },
        },
        required: ['agentId'],
      },
    };

    return {
      definition,
      execute: async (input: ToolInput): Promise<ToolOutput> => {
        try {
          const { dir, agentId } = input as { dir?: string; agentId: string };
          const workspace = this.getWorkspacePath(agentId);
          let searchDir = workspace;

          if (dir) {
            if (!validatePath(dir)) {
              return { success: false, error: 'Invalid path: path traversal not allowed' };
            }
            searchDir = path.join(workspace, dir);
          }

          if (!fs.existsSync(searchDir)) {
            return { success: true, result: { scripts: [] } };
          }

          const extensions = ['.js', '.ts', '.py', '.sh', '.bat'];
          const scripts: string[] = [];

          const scanDir = (currentDir: string, relativePath: string = '') => {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(currentDir, entry.name);
              const relPath = path.join(relativePath, entry.name);

              if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
                scanDir(fullPath, relPath);
              } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
                scripts.push(relPath);
              }
            }
          };

          scanDir(searchDir);

          return { success: true, result: { scripts } };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'List scripts failed';
          return { success: false, error: msg };
        }
      },
    };
  }

  private async executeScript(
    runtime: string,
    scriptPath: string,
    args: string[],
    agentId: string
  ): Promise<ToolOutput> {
    try {
      if (!validatePath(scriptPath)) {
        return { success: false, error: 'Invalid path: path traversal not allowed' };
      }

      const workspace = this.getWorkspacePath(agentId);
      const fullPath = path.join(workspace, scriptPath);

      if (!fs.existsSync(fullPath)) {
        return { success: false, error: `Script not found: ${scriptPath}` };
      }

      const fullCommand = `${runtime} "${fullPath}" ${args.map(a => `"${a}"`).join(' ')}`;
      logger.info({ runtime, scriptPath, args }, 'Running script');

      const startTime = Date.now();

      try {
        const { stdout, stderr } = await execAsync(fullCommand, {
          cwd: workspace,
          timeout: 60000,
        });

        return {
          success: true,
          result: {
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: 0,
            durationMs: Date.now() - startTime,
          },
        };
      } catch (execError: any) {
        return {
          success: false,
          result: {
            stdout: execError.stdout?.trim() || '',
            stderr: execError.stderr?.trim() || '',
            exitCode: execError.code || 1,
            durationMs: Date.now() - startTime,
          },
          error: execError.message,
        };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Script execution failed';
      return { success: false, error: msg };
    }
  }
}
