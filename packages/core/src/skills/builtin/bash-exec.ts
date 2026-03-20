import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';
import type { Skill, Tool, ToolInput, ToolOutput } from '../types.js';
import { DockerSandbox } from '../../sandbox/docker-sandbox.js';

const execAsync = promisify(exec);

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//i,
  /sudo\s+/i,
  /chmod\s+777/i,
  /curl\s+\|\s*bash/i,
  /;\s*rm\s+-rf/i,
  /wget.*\|\s*bash/i,
  /fork\s+bomb/i,
];

const sandboxEnabled = process.env.SANDBOX_ENABLED === 'true';
let dockerSandbox: DockerSandbox | null = null;

if (sandboxEnabled) {
  dockerSandbox = new DockerSandbox();
  dockerSandbox.cleanupOrphanedContainers().catch(() => {});
}

function isDangerous(command: string): boolean {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return true;
    }
  }
  return false;
}

async function runBashLocal(command: string, workspacePath: string): Promise<ToolOutput> {
  if (isDangerous(command)) {
    return {
      success: false,
      error: 'Command blocked: potentially dangerous command detected',
    };
  }

  const resolvedCwd = resolve(workspacePath);

  try {
    const result = await execAsync(command, {
      cwd: resolvedCwd,
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      shell: '/bin/bash',
    });

    return {
      success: true,
      result: {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: 0,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      if ('killTime' in error) {
        return {
          success: false,
          error: 'Command timeout (30s exceeded)',
        };
      }

      const execError = error as NodeJS.ErrnoException;
      if (execError.code === 'ENOENT') {
        return {
          success: false,
          error: 'Command not found',
        };
      }

      return {
        success: true,
        result: {
          stdout: '',
          stderr: error.message,
          exitCode: execError.code || 1,
        },
      };
    }

    return {
      success: false,
      error: 'Unknown execution error',
    };
  }
}

export function createBashExecSkill(workspacePath: string): Skill {
  const runBashTool: Tool = {
    definition: {
      name: 'run_bash',
      description: 'Execute a bash command in the workspace directory (uses sandbox if available)',
      inputSchema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The bash command to execute',
          },
          cwd: {
            type: 'string',
            description: 'Optional working directory (relative to workspace)',
          },
        },
        required: ['command'],
      },
    },
    execute: async (input: ToolInput): Promise<ToolOutput> => {
      const command = input.command as string;
      if (!command) {
        return { success: false, error: 'Command parameter is required' };
      }

      if (sandboxEnabled && dockerSandbox) {
        const result = await dockerSandbox.executeScript('bash', command);
        return {
          success: result.success,
          result: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
          },
          error: result.error,
        };
      }

      const cwd = input.cwd as string | undefined;
      const execPath = cwd ? resolve(workspacePath, cwd) : workspacePath;

      return runBashLocal(command, execPath);
    },
  };

  return {
    id: 'bash_exec',
    name: 'Bash Execution',
    description: 'Execute bash commands in the workspace (with safety restrictions)',
    tools: [runBashTool],
  };
}
