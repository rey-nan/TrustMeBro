import pino from 'pino';
import { LLMClient } from '../llm/index.js';
import type { AgentSOUL } from './types.js';
export interface SOULGeneratorConfig {
    name: string;
    role: string;
    description?: string;
}
export declare class SOULGenerator {
    private client;
    private logger;
    constructor(client: LLMClient, logger?: pino.Logger);
    generate(config: SOULGeneratorConfig): Promise<AgentSOUL>;
    private parseSoul;
    toSystemPrompt(soul: AgentSOUL, extras?: string): string;
}
//# sourceMappingURL=soul-generator.d.ts.map