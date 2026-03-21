import pino from 'pino';
import type { Skill, Tool } from './types.js';
export declare class SkillRegistry {
    private skills;
    private agentSkills;
    private logger;
    private configPath;
    constructor(configPath?: string, logger?: pino.Logger);
    register(skill: Skill): void;
    get(skillId: string): Skill | undefined;
    list(): Skill[];
    getToolsForAgent(skillIds: string[]): Tool[];
    buildToolsContext(skillIds: string[]): string;
    assignSkills(agentId: string, skillIds: string[]): void;
    getAgentSkills(agentId: string): string[];
    private loadAgentSkills;
    private saveAgentSkills;
    initializeSkills(): Promise<void>;
    teardownSkills(): Promise<void>;
}
//# sourceMappingURL=registry.d.ts.map