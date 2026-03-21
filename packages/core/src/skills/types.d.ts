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
export interface Skill {
    id: string;
    name: string;
    description: string;
    tools: Tool[];
    setup?(): Promise<void>;
    teardown?(): Promise<void>;
}
export interface AgentSkillConfig {
    agentId: string;
    skillIds: string[];
}
//# sourceMappingURL=types.d.ts.map