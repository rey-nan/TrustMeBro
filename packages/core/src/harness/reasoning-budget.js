import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import pino from 'pino';
export const REASONING_SANDWICH = {
    planning: 'xhigh',
    execution: 'high',
    verification: 'xhigh',
};
const DEFAULT_CONFIG = {
    default: REASONING_SANDWICH,
    byAgentLevel: {
        intern: { planning: 'medium', execution: 'low', verification: 'medium' },
        specialist: { planning: 'high', execution: 'medium', verification: 'high' },
        lead: REASONING_SANDWICH,
    },
};
const CONFIG_PATH = './data/reasoning-budget.json';
export class ReasoningBudget {
    config;
    logger;
    constructor(logger) {
        this.logger = logger ?? pino({ name: 'ReasoningBudget' });
        this.config = this.loadConfig();
    }
    loadConfig() {
        try {
            if (existsSync(CONFIG_PATH)) {
                const data = readFileSync(CONFIG_PATH, 'utf-8');
                const parsed = JSON.parse(data);
                this.logger.info('Loaded reasoning budget config from file');
                return parsed;
            }
        }
        catch (error) {
            this.logger.warn({ error: error instanceof Error ? error.message : 'Unknown' }, 'Failed to load config');
        }
        return DEFAULT_CONFIG;
    }
    saveConfig() {
        try {
            const dir = dirname(CONFIG_PATH);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
            this.logger.info('Saved reasoning budget config');
        }
        catch (error) {
            this.logger.error({ error: error instanceof Error ? error.message : 'Unknown' }, 'Failed to save config');
        }
    }
    getConfig() {
        return this.config;
    }
    setConfig(config) {
        this.config = {
            ...this.config,
            ...config,
            default: { ...this.config.default, ...config.default },
        };
        if (config.byAgentLevel) {
            this.config.byAgentLevel = {
                ...this.config.byAgentLevel,
                ...config.byAgentLevel,
            };
        }
        this.saveConfig();
    }
    getReasoningConfig(agentLevel) {
        if (agentLevel && this.config.byAgentLevel) {
            const levelKey = agentLevel;
            if (this.config.byAgentLevel[levelKey]) {
                return this.config.byAgentLevel[levelKey];
            }
        }
        return this.config.default;
    }
    getTemperature(level) {
        const temps = {
            low: 0.3,
            medium: 0.5,
            high: 0.7,
            xhigh: 0.9,
        };
        return temps[level];
    }
    getMaxTokens(level, base) {
        const multipliers = {
            low: 0.5,
            medium: 0.75,
            high: 1.0,
            xhigh: 1.5,
        };
        return Math.round(base * multipliers[level]);
    }
    getSystemAddition(level, phase) {
        const instructions = {
            planning: {
                low: 'Plan your approach briefly.',
                medium: 'Plan your approach considering main steps.',
                high: 'Plan thoroughly. Consider edge cases and dependencies.',
                xhigh: 'Think deeply and extensively before acting. Consider all edge cases, failure modes, and alternative approaches.',
            },
            execution: {
                low: 'Execute directly and efficiently.',
                medium: 'Execute carefully and methodically.',
                high: 'Execute efficiently. Be thorough but focused.',
                xhigh: 'Execute with maximum thoroughness. Double-check every step. Do not cut corners.',
            },
            verification: {
                low: 'Quick verification is sufficient.',
                medium: 'Verify your work before presenting.',
                high: 'Verify thoroughly. Check your work carefully.',
                xhigh: 'Verify rigorously. Check every assumption. Don\'t accept partial success. Consider edge cases.',
            },
        };
        return instructions[phase]?.[level] ?? '';
    }
    applyToRequest(request, level, phase) {
        const temperature = request.temperature ?? this.getTemperature(level);
        const maxTokens = this.getMaxTokens(level, request.maxTokens ?? 2000);
        const systemAddition = this.getSystemAddition(level, phase);
        this.logger.debug({
            phase,
            level,
            temperature,
            maxTokens,
            hasSystemAddition: !!systemAddition,
        }, 'Applied reasoning budget');
        return { temperature, maxTokens, systemAddition };
    }
    resetToDefault() {
        this.config = DEFAULT_CONFIG;
        this.saveConfig();
    }
}
//# sourceMappingURL=reasoning-budget.js.map