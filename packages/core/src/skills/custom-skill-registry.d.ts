import type { CustomSkillDefinition } from './custom-skill.js';
import { CustomSkill } from './custom-skill.js';
export declare class CustomSkillRegistry {
    private skills;
    private filePath;
    constructor(dataDir?: string);
    private load;
    private save;
    create(data: Omit<CustomSkillDefinition, 'id' | 'createdAt' | 'updatedAt'>): CustomSkillDefinition;
    get(id: string): CustomSkillDefinition | undefined;
    list(): CustomSkillDefinition[];
    update(id: string, data: Partial<CustomSkillDefinition>): CustomSkillDefinition | undefined;
    remove(id: string): boolean;
    toSkill(id: string): CustomSkill | undefined;
    test(id: string, toolName: string, input: Record<string, unknown>): Promise<{
        success: boolean;
        result?: unknown;
        error?: string;
    }>;
}
//# sourceMappingURL=custom-skill-registry.d.ts.map