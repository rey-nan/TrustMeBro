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
export declare const REASONING_SANDWICH: ReasoningConfig;
export declare class ReasoningBudget {
    private config;
    private logger;
    constructor(logger?: pino.Logger);
    private loadConfig;
    private saveConfig;
    getConfig(): ReasoningBudgetConfig;
    setConfig(config: Partial<ReasoningBudgetConfig>): void;
    getReasoningConfig(agentLevel?: string): ReasoningConfig;
    getTemperature(level: ReasoningLevel): number;
    getMaxTokens(level: ReasoningLevel, base: number): number;
    getSystemAddition(level: ReasoningLevel, phase: keyof ReasoningConfig): string;
    applyToRequest(request: {
        temperature?: number;
        maxTokens?: number;
        system?: string;
    }, level: ReasoningLevel, phase: keyof ReasoningConfig): {
        temperature: number;
        maxTokens: number;
        systemAddition: string;
    };
    resetToDefault(): void;
}
//# sourceMappingURL=reasoning-budget.d.ts.map