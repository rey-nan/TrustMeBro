import pino from 'pino';
import { DockerSandbox } from '../../sandbox/docker-sandbox.js';
import type { Skill, Tool, ToolInput, ToolOutput } from '../types.js';

let sandbox: DockerSandbox | null = null;
let sandboxAvailable = false;

async function initSandbox(): Promise<void> {
  if (!sandbox) {
    sandbox = new DockerSandbox();
    const status = await sandbox.checkAvailability();
    sandboxAvailable = status.available;
  }
}

async function runCode(language: 'javascript' | 'python' | 'typescript', code: string, timeoutMs: number = 30000): Promise<ToolOutput> {
  await initSandbox();

  if (!sandboxAvailable || !sandbox) {
    return {
      success: false,
      error: 'Docker sandbox not available. Please ensure Docker is installed and running.',
    };
  }

  const result = await sandbox.executeScript(language, code, timeoutMs);

  return {
    success: result.success,
    result: {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      durationMs: result.durationMs,
    },
    error: result.error,
  };
}

export const codeRunnerSkill: Skill = {
  id: 'code_runner',
  name: 'Code Runner',
  description: 'Run code in isolated Docker sandbox',
  tools: [
    {
      definition: {
        name: 'run_javascript',
        description: 'Run JavaScript code in a Docker sandbox',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'The JavaScript code to execute',
            },
          },
          required: ['code'],
        },
      },
      execute: async (input: ToolInput): Promise<ToolOutput> => {
        const code = input.code as string;
        if (!code) {
          return { success: false, error: 'Code parameter is required' };
        }
        return runCode('javascript', code);
      },
    },
    {
      definition: {
        name: 'run_python',
        description: 'Run Python code in a Docker sandbox',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'The Python code to execute',
            },
          },
          required: ['code'],
        },
      },
      execute: async (input: ToolInput): Promise<ToolOutput> => {
        const code = input.code as string;
        if (!code) {
          return { success: false, error: 'Code parameter is required' };
        }
        return runCode('python', code);
      },
    },
    {
      definition: {
        name: 'run_typescript',
        description: 'Run TypeScript code in a Docker sandbox',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'The TypeScript code to execute',
            },
          },
          required: ['code'],
        },
      },
      execute: async (input: ToolInput): Promise<ToolOutput> => {
        const code = input.code as string;
        if (!code) {
          return { success: false, error: 'Code parameter is required' };
        }
        return runCode('typescript', code, 60000);
      },
    },
  ],
};
