export interface ToolInput {
  [key: string]: unknown;
}

export interface ToolOutput {
  success: boolean;
  result?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
    }>;
    required?: string[];
  };
}

export interface Tool {
  definition: ToolDefinition;
  execute(input: ToolInput): Promise<ToolOutput>;
}

export interface SkillExample {
  input: string;
  output: string;
  description: string;
}

export type SkillFreedom = 'low' | 'medium' | 'high';

export interface Skill {
  id: string;
  name: string;
  description: string;
  tools: Tool[];
  category?: string;
  tags?: string[];
  examples?: SkillExample[];
  freedom?: SkillFreedom;
  requires?: string[];
  setup?(): Promise<void>;
  teardown?(): Promise<void>;
}

export interface AgentSkillConfig {
  agentId: string;
  skillIds: string[];
}
