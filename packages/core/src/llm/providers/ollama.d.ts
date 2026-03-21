import type { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from '../types.js';
export declare class OllamaProvider implements LLMProvider {
    name: string;
    private baseUrl;
    private defaultModel;
    constructor(config: ProviderConfig);
    call(request: LLMRequest): Promise<LLMResponse>;
    isAvailable(): Promise<boolean>;
}
//# sourceMappingURL=ollama.d.ts.map