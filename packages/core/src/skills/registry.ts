import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import pino from 'pino';
import type { Skill, Tool } from './types.js';

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private agentSkills: Map<string, string[]> = new Map();
  private logger: pino.Logger;
  private configPath: string;

  constructor(configPath: string = './data/agent-skills.json', logger?: pino.Logger) {
    this.logger = logger ?? pino({ name: 'SkillRegistry' });
    this.configPath = configPath;
    this.loadAgentSkills();
  }

  register(skill: Skill): void {
    this.skills.set(skill.id, skill);
    this.logger.info({ skillId: skill.id, toolCount: skill.tools.length }, 'Skill registered');
  }

  get(skillId: string): Skill | undefined {
    return this.skills.get(skillId);
  }

  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  getToolsForAgent(skillIds: string[]): Tool[] {
    const tools: Tool[] = [];
    for (const skillId of skillIds) {
      const skill = this.skills.get(skillId);
      if (skill) {
        tools.push(...skill.tools);
      }
    }
    return tools;
  }

  buildToolsContext(skillIds: string[]): string {
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

  assignSkills(agentId: string, skillIds: string[]): void {
    this.agentSkills.set(agentId, skillIds);
    this.saveAgentSkills();
    this.logger.info({ agentId, skillIds }, 'Skills assigned to agent');
  }

  getAgentSkills(agentId: string): string[] {
    return this.agentSkills.get(agentId) ?? [];
  }

  private loadAgentSkills(): void {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(data) as Record<string, string[]>;
        for (const [agentId, skillIds] of Object.entries(parsed)) {
          this.agentSkills.set(agentId, skillIds);
        }
        this.logger.info({ agentCount: Object.keys(parsed).length }, 'Loaded agent skills config');
      }
    } catch (error) {
      this.logger.warn({ error: error instanceof Error ? error.message : 'Unknown' }, 'Failed to load agent skills');
    }
  }

  private saveAgentSkills(): void {
    try {
      const dir = dirname(this.configPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const data: Record<string, string[]> = {};
      for (const [agentId, skillIds] of this.agentSkills.entries()) {
        data[agentId] = skillIds;
      }
      writeFileSync(this.configPath, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : 'Unknown' }, 'Failed to save agent skills');
    }
  }

  async initializeSkills(): Promise<void> {
    for (const skill of this.skills.values()) {
      if (skill.setup) {
        try {
          await skill.setup();
          this.logger.debug({ skillId: skill.id }, 'Skill setup completed');
        } catch (error) {
          this.logger.warn({ skillId: skill.id, error: error instanceof Error ? error.message : 'Unknown' }, 'Skill setup failed');
        }
      }
    }
  }

  async teardownSkills(): Promise<void> {
    for (const skill of this.skills.values()) {
      if (skill.teardown) {
        try {
          await skill.teardown();
          this.logger.debug({ skillId: skill.id }, 'Skill teardown completed');
        } catch (error) {
          this.logger.warn({ skillId: skill.id, error: error instanceof Error ? error.message : 'Unknown' }, 'Skill teardown failed');
        }
      }
    }
  }
}
