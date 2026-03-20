import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Skill, Tool, ToolInput, ToolOutput } from '../types.js';

const MEMORY_FILE = 'MEMORY.md';
const WORKING_FILE = 'WORKING.md';

function getMemoryPath(workspacePath: string): string {
  return join(workspacePath, MEMORY_FILE);
}

function ensureMemoryFile(workspacePath: string): void {
  const memoryPath = getMemoryPath(workspacePath);
  if (!existsSync(memoryPath)) {
    writeFileSync(memoryPath, `# Agent Memory\n\n`, 'utf-8');
  }
}

async function rememberImpl(key: string, value: string, workspacePath: string): Promise<ToolOutput> {
  try {
    ensureMemoryFile(workspacePath);

    const memoryPath = getMemoryPath(workspacePath);
    const timestamp = new Date().toISOString();
    const entry = `\n## ${key}\n_${timestamp}_\n\n${value}\n`;

    appendFileSync(memoryPath, entry, 'utf-8');

    return {
      success: true,
      result: `Remembered: ${key}`,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save memory' };
  }
}

async function recallImpl(key: string, workspacePath: string): Promise<ToolOutput> {
  try {
    const memoryPath = getMemoryPath(workspacePath);

    if (!existsSync(memoryPath)) {
      return { success: true, result: 'No memory entries found.' };
    }

    const content = readFileSync(memoryPath, 'utf-8');

    const sectionMatch = content.match(new RegExp(`##\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\n_([^_]+)_\\s*\\n([\\s\\S]*?)(?=## |$)`, 'i'));

    if (sectionMatch && sectionMatch[2]) {
      return {
        success: true,
        result: `${sectionMatch[2].trim()}`,
      };
    }

    return {
      success: true,
      result: `No memory found for key: ${key}`,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to recall memory' };
  }
}

async function updateWorkingImpl(content: string, workspacePath: string): Promise<ToolOutput> {
  try {
    const workingPath = join(workspacePath, WORKING_FILE);
    writeFileSync(workingPath, content, 'utf-8');

    return {
      success: true,
      result: `Working file updated`,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update working file' };
  }
}

async function readWorkingImpl(workspacePath: string): Promise<ToolOutput> {
  try {
    const workingPath = join(workspacePath, WORKING_FILE);

    if (!existsSync(workingPath)) {
      return { success: true, result: 'No working file found.' };
    }

    const content = readFileSync(workingPath, 'utf-8');
    return { success: true, result: content };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to read working file' };
  }
}

export function createMemoryToolsSkill(workspacePath: string): Skill {
  const rememberTool: Tool = {
    definition: {
      name: 'remember',
      description: 'Save a key-value pair to agent memory',
      inputSchema: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'The memory key',
          },
          value: {
            type: 'string',
            description: 'The value to remember',
          },
        },
        required: ['key', 'value'],
      },
    },
    execute: async (input: ToolInput): Promise<ToolOutput> => {
      const key = input.key as string;
      const value = input.value as string;
      if (!key || !value) {
        return { success: false, error: 'Key and value parameters are required' };
      }
      return rememberImpl(key, value, workspacePath);
    },
  };

  const recallTool: Tool = {
    definition: {
      name: 'recall',
      description: 'Retrieve a value from agent memory by key',
      inputSchema: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'The memory key to recall',
          },
        },
        required: ['key'],
      },
    },
    execute: async (input: ToolInput): Promise<ToolOutput> => {
      const key = input.key as string;
      if (!key) {
        return { success: false, error: 'Key parameter is required' };
      }
      return recallImpl(key, workspacePath);
    },
  };

  const updateWorkingTool: Tool = {
    definition: {
      name: 'update_working',
      description: 'Update the WORKING.md file with current task state',
      inputSchema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The content to write to WORKING.md',
          },
        },
        required: ['content'],
      },
    },
    execute: async (input: ToolInput): Promise<ToolOutput> => {
      const content = input.content as string;
      if (!content) {
        return { success: false, error: 'Content parameter is required' };
      }
      return updateWorkingImpl(content, workspacePath);
    },
  };

  const readWorkingTool: Tool = {
    definition: {
      name: 'read_working',
      description: 'Read the current WORKING.md file',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    execute: async (): Promise<ToolOutput> => {
      return readWorkingImpl(workspacePath);
    },
  };

  return {
    id: 'memory',
    name: 'Memory Tools',
    description: 'Save and recall information, update working state',
    tools: [rememberTool, recallTool, updateWorkingTool, readWorkingTool],
  };
}
