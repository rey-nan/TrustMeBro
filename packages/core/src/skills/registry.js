import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import pino from 'pino';
export class SkillRegistry {
    skills = new Map();
    agentSkills = new Map();
    logger;
    configPath;
    constructor(configPath = './data/agent-skills.json', logger) {
        this.logger = logger ?? pino({ name: 'SkillRegistry' });
        this.configPath = configPath;
        this.loadAgentSkills();
    }
    register(skill) {
        this.skills.set(skill.id, skill);
        this.logger.info({ skillId: skill.id, toolCount: skill.tools.length }, 'Skill registered');
    }
    get(skillId) {
        return this.skills.get(skillId);
    }
    list() {
        return Array.from(this.skills.values());
    }
    getToolsForAgent(skillIds) {
        const tools = [];
        for (const skillId of skillIds) {
            const skill = this.skills.get(skillId);
            if (skill) {
                tools.push(...skill.tools);
            }
        }
        return tools;
    }
    buildToolsContext(skillIds) {
        const tools = this.getToolsForAgent(skillIds);
        if (tools.length === 0) {
            return '';
        }
        const toolDescriptions = tools.map((tool) => {
            const params = Object.entries(tool.definition.inputSchema.properties)
                .map(([name, info]) => `  - ${name}: ${info.description}`)
                .join('\n');
            return `- ${tool.definition.name}(${Object.keys(tool.definition.inputSchema.properties).join(', ')}): ${tool.definition.description}\n${params}`;
        }).join('\n\n');
        return `AVAILABLE TOOLS:
Use these tools by responding with:
<tool_call>
{
n  "tool": "tool_name",
  "input": { ... }
}
</tool_call>

Tools:
${toolDescriptions}`;
    }
    assignSkills(agentId, skillIds) {
        this.agentSkills.set(agentId, skillIds);
        this.saveAgentSkills();
        this.logger.info({ agentId, skillIds }, 'Skills assigned to agent');
    }
    getAgentSkills(agentId) {
        return this.agentSkills.get(agentId) ?? [];
    }
    loadAgentSkills() {
        try {
            if (existsSync(this.configPath)) {
                const data = readFileSync(this.configPath, 'utf-8');
                const parsed = JSON.parse(data);
                for (const [agentId, skillIds] of Object.entries(parsed)) {
                    this.agentSkills.set(agentId, skillIds);
                }
                this.logger.info({ agentCount: Object.keys(parsed).length }, 'Loaded agent skills config');
            }
        }
        catch (error) {
            this.logger.warn({ error: error instanceof Error ? error.message : 'Unknown' }, 'Failed to load agent skills');
        }
    }
    saveAgentSkills() {
        try {
            const dir = dirname(this.configPath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            const data = {};
            for (const [agentId, skillIds] of this.agentSkills.entries()) {
                data[agentId] = skillIds;
            }
            writeFileSync(this.configPath, JSON.stringify(data, null, 2));
        }
        catch (error) {
            this.logger.error({ error: error instanceof Error ? error.message : 'Unknown' }, 'Failed to save agent skills');
        }
    }
    async initializeSkills() {
        for (const skill of this.skills.values()) {
            if (skill.setup) {
                try {
                    await skill.setup();
                    this.logger.debug({ skillId: skill.id }, 'Skill setup completed');
                }
                catch (error) {
                    this.logger.warn({ skillId: skill.id, error: error instanceof Error ? error.message : 'Unknown' }, 'Skill setup failed');
                }
            }
        }
    }
    async teardownSkills() {
        for (const skill of this.skills.values()) {
            if (skill.teardown) {
                try {
                    await skill.teardown();
                    this.logger.debug({ skillId: skill.id }, 'Skill teardown completed');
                }
                catch (error) {
                    this.logger.warn({ skillId: skill.id, error: error instanceof Error ? error.message : 'Unknown' }, 'Skill teardown failed');
                }
            }
        }
    }
}
//# sourceMappingURL=registry.js.map