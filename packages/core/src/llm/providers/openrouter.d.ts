import type { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from '../types.js';
export declare class OpenRouterProvider implements LLMProvider {
    name: string;
    private apiKey;
    private baseUrl;
    private defaultModel;
    constructor(config: ProviderConfig);
    call(request: LLMRequest): Promise<LLMResponse>;
    isAvailable(): Promise<boolean>;
}
//# sourceMappingURL=openrouter.d.ts.map