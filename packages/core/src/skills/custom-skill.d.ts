import type { Skill, Tool } from './types.js';
export interface CustomToolDefinition {
    id?: string;
    name: string;
    description: string;
    inputSchema: {
        properties: Record<string, {
            type: string;
            description: string;
        }>;
        required: string[];
    };
    executionType: 'bash' | 'node' | 'python' | 'http';
    executionCode: string;
    timeout?: number;
}
export interface CustomSkillDefinition {
    id: string;
    name: string;
    description: string;
    tools: CustomToolDefinition[];
    createdAt: number;
    updatedAt: number;
}
export declare class CustomSkill implements Skill {
    id: string;
    name: string;
    description: string;
    tools: Tool[];
    constructor(definition: CustomSkillDefinition);
}
//# sourceMappingURL=custom-skill.d.ts.map