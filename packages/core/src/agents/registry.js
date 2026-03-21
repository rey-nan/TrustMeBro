import pino from 'pino';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
const AGENTS_FILE = 'data/agents.json';
export class AgentRegistry {
    agents = new Map();
    logger;
    filePath;
    constructor(filePath, logger) {
        this.logger = logger ?? pino({ name: 'AgentRegistry' });
        this.filePath = filePath ?? AGENTS_FILE;
        this.load();
    }
    register(config) {
        if (!config.id || !config.name || !config.systemPrompt) {
            throw new Error('Agent config must have id, name, and systemPrompt');
        }
        this.agents.set(config.id, config);
        this.save();
        this.logger.info({ agentId: config.id, agentName: config.name }, 'Agent registered');
    }
    get(agentId) {
        return this.agents.get(agentId);
    }
    list() {
        return Array.from(this.agents.values());
    }
    remove(agentId) {
        const deleted = this.agents.delete(agentId);
        if (deleted) {
            this.save();
            this.logger.info({ agentId }, 'Agent removed');
        }
        return deleted;
    }
    load() {
        try {
            if (!existsSync(this.filePath)) {
                this.logger.info({ filePath: this.filePath }, 'No agents file found, starting fresh');
                return;
            }
            const data = readFileSync(this.filePath, 'utf-8');
            const agents = JSON.parse(data);
            for (const agent of agents) {
                if (agent.id && agent.name && agent.systemPrompt) {
                    this.agents.set(agent.id, agent);
                }
            }
            this.logger.info({ count: this.agents.size }, 'Agents loaded from file');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error({ error: message }, 'Failed to load agents file');
        }
    }
    save() {
        try {
            const dir = dirname(this.filePath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            const agents = Array.from(this.agents.values());
            writeFileSync(this.filePath, JSON.stringify(agents, null, 2), 'utf-8');
            this.logger.debug({ filePath: this.filePath, count: agents.length }, 'Agents saved');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error({ error: message }, 'Failed to save agents file');
        }
    }
}
//# sourceMappingURL=registry.js.map