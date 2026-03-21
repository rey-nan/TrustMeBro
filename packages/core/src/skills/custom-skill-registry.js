import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import pino from 'pino';
import { CustomSkill } from './custom-skill.js';
const logger = pino({ name: 'CustomSkillRegistry' });
export class CustomSkillRegistry {
    skills = new Map();
    filePath;
    constructor(dataDir = './data') {
        this.filePath = path.join(dataDir, 'custom-skills.json');
        this.load();
    }
    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
                for (const skill of data) {
                    this.skills.set(skill.id, skill);
                }
                logger.info({ count: this.skills.size }, 'Custom skills loaded');
            }
        }
        catch (error) {
            logger.error({ error }, 'Failed to load custom skills');
        }
    }
    save() {
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.filePath, JSON.stringify([...this.skills.values()], null, 2));
        }
        catch (error) {
            logger.error({ error }, 'Failed to save custom skills');
        }
    }
    create(data) {
        const now = Date.now();
        const skill = {
            id: `custom-${randomUUID().substring(0, 8)}`,
            name: data.name,
            description: data.description,
            tools: data.tools.map(t => ({
                ...t,
                id: t.id || `tool-${randomUUID().substring(0, 8)}`,
            })),
            createdAt: now,
            updatedAt: now,
        };
        this.skills.set(skill.id, skill);
        this.save();
        logger.info({ id: skill.id, name: skill.name }, 'Custom skill created');
        return skill;
    }
    get(id) {
        return this.skills.get(id);
    }
    list() {
        return [...this.skills.values()];
    }
    update(id, data) {
        const existing = this.skills.get(id);
        if (!existing)
            return undefined;
        const updated = {
            ...existing,
            ...data,
            id,
            updatedAt: Date.now(),
        };
        this.skills.set(id, updated);
        this.save();
        logger.info({ id }, 'Custom skill updated');
        return updated;
    }
    remove(id) {
        const deleted = this.skills.delete(id);
        if (deleted) {
            this.save();
            logger.info({ id }, 'Custom skill removed');
        }
        return deleted;
    }
    toSkill(id) {
        const definition = this.skills.get(id);
        if (!definition)
            return undefined;
        return new CustomSkill(definition);
    }
    async test(id, toolName, input) {
        const skill = this.toSkill(id);
        if (!skill) {
            return { success: false, error: 'Skill not found' };
        }
        const tool = skill.tools.find(t => t.definition.name === toolName);
        if (!tool) {
            return { success: false, error: `Tool not found: ${toolName}` };
        }
        try {
            const result = await tool.execute(input);
            return result;
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'Test failed';
            return { success: false, error: msg };
        }
    }
}
//# sourceMappingURL=custom-skill-registry.js.map