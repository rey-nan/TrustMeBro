import pino from 'pino';
import type { LLMRequest, LLMResponse, ProviderConfig } from './types.js';
export type ProviderName = 'openrouter' | 'ollama' | 'groq' | 'openai-compatible';
export declare class LLMClient {
    private provider;
    private logger;
    private currentProviderName;
    constructor(logger?: pino.Logger);
    private createProvider;
    call(request: LLMRequest): Promise<LLMResponse>;
    switchProvider(name: ProviderName, config?: Partial<ProviderConfig>): void;
    isAvailable(): Promise<boolean>;
    getCurrentProvider(): ProviderName;
}
//# sourceMappingURL=client.d.ts.map