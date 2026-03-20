import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import pino from 'pino';

export type ReasoningLevel = 'low' | 'medium' | 'high' | 'xhigh';

export interface ReasoningConfig {
  planning: ReasoningLevel;
  execution: ReasoningLevel;
  verification: ReasoningLevel;
}

export interface ReasoningBudgetConfig {
  default: ReasoningConfig;
  byAgentLevel?: {
    intern: ReasoningConfig;
    specialist: ReasoningConfig;
    lead: ReasoningConfig;
  };
}

export const REASONING_SANDWICH: ReasoningConfig = {
  planning: 'xhigh',
  execution: 'high',
  verification: 'xhigh',
};

const DEFAULT_CONFIG: ReasoningBudgetConfig = {
  default: REASONING_SANDWICH,
  byAgentLevel: {
    intern: { planning: 'medium', execution: 'low', verification: 'medium' },
    specialist: { planning: 'high', execution: 'medium', verification: 'high' },
    lead: REASONING_SANDWICH,
  },
};

const CONFIG_PATH = './data/reasoning-budget.json';

export class ReasoningBudget {
  private config: ReasoningBudgetConfig;
  private logger: pino.Logger;

  constructor(logger?: pino.Logger) {
    this.logger = logger ?? pino({ name: 'ReasoningBudget' });
    this.config = this.loadConfig();
  }

  private loadConfig(): ReasoningBudgetConfig {
    try {
      if (existsSync(CONFIG_PATH)) {
        const data = readFileSync(CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(data) as ReasoningBudgetConfig;
        this.logger.info('Loaded reasoning budget config from file');
        return parsed;
      }
    } catch (error) {
      this.logger.warn({ error: error instanceof Error ? error.message : 'Unknown' }, 'Failed to load config');
    }
    return DEFAULT_CONFIG;
  }

  private saveConfig(): void {
    try {
      const dir = dirname(CONFIG_PATH);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
      this.logger.info('Saved reasoning budget config');
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : 'Unknown' }, 'Failed to save config');
    }
  }

  getConfig(): ReasoningBudgetConfig {
    return this.config;
  }

  setConfig(config: Partial<ReasoningBudgetConfig>): void {
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

  getReasoningConfig(agentLevel?: string): ReasoningConfig {
    if (agentLevel && this.config.byAgentLevel) {
      const levelKey = agentLevel as keyof typeof this.config.byAgentLevel;
      if (this.config.byAgentLevel[levelKey]) {
        return this.config.byAgentLevel[levelKey];
      }
    }
    return this.config.default;
  }

  getTemperature(level: ReasoningLevel): number {
    const temps: Record<ReasoningLevel, number> = {
      low: 0.3,
      medium: 0.5,
      high: 0.7,
      xhigh: 0.9,
    };
    return temps[level];
  }

  getMaxTokens(level: ReasoningLevel, base: number): number {
    const multipliers: Record<ReasoningLevel, number> = {
      low: 0.5,
      medium: 0.75,
      high: 1.0,
      xhigh: 1.5,
    };
    return Math.round(base * multipliers[level]);
  }

  getSystemAddition(level: ReasoningLevel, phase: keyof ReasoningConfig): string {
    const instructions: Record<string, Record<ReasoningLevel, string>> = {
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

  applyToRequest(
    request: { temperature?: number; maxTokens?: number; system?: string },
    level: ReasoningLevel,
    phase: keyof ReasoningConfig
  ): { temperature: number; maxTokens: number; systemAddition: string } {
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

  resetToDefault(): void {
    this.config = DEFAULT_CONFIG;
    this.saveConfig();
  }
}
