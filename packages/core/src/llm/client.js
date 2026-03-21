import pino from 'pino';
import { OpenRouterProvider } from './providers/openrouter.js';
import { OllamaProvider } from './providers/ollama.js';
import { GroqProvider } from './providers/groq.js';
import { OpenAICompatibleProvider } from './providers/openai-compatible.js';
const PROVIDERS = {
    'openrouter': OpenRouterProvider,
    'ollama': OllamaProvider,
    'groq': GroqProvider,
    'openai-compatible': OpenAICompatibleProvider,
};
export class LLMClient {
    provider;
    logger;
    currentProviderName;
    constructor(logger) {
        this.logger = logger ?? pino({ name: 'LLMClient' });
        const providerName = (process.env.LLM_PROVIDER ?? 'openrouter');
        const config = {
            apiKey: process.env.LLM_API_KEY,
            baseUrl: process.env.LLM_BASE_URL,
            defaultModel: process.env.LLM_DEFAULT_MODEL,
        };
        this.currentProviderName = providerName;
        this.provider = this.createProvider(providerName, config);
    }
    createProvider(name, config) {
        const ProviderClass = PROVIDERS[name];
        if (!ProviderClass) {
            throw new Error(`Unknown LLM provider: ${name}. Available: ${Object.keys(PROVIDERS).join(', ')}`);
        }
        return new ProviderClass(config);
    }
    async call(request) {
        this.logger.info({
            provider: this.currentProviderName,
            model: request.model ?? 'default',
            messageCount: request.messages.length,
        }, 'LLM request started');
        try {
            const response = await this.provider.call(request);
            this.logger.info({
                provider: response.provider,
                model: response.model,
                inputTokens: response.usage.inputTokens,
                outputTokens: response.usage.outputTokens,
                totalTokens: response.usage.totalTokens,
                durationMs: response.durationMs,
            }, 'LLM request completed');
            return response;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error({ provider: this.currentProviderName, error: message }, 'LLM request failed');
            throw error;
        }
    }
    switchProvider(name, config) {
        const newConfig = {
            apiKey: config?.apiKey ?? process.env.LLM_API_KEY,
            baseUrl: config?.baseUrl ?? process.env.LLM_BASE_URL,
            defaultModel: config?.defaultModel ?? process.env.LLM_DEFAULT_MODEL,
        };
        this.logger.info({ oldProvider: this.currentProviderName, newProvider: name }, 'Switching LLM provider');
        this.currentProviderName = name;
        this.provider = this.createProvider(name, newConfig);
    }
    async isAvailable() {
        return this.provider.isAvailable();
    }
    getCurrentProvider() {
        return this.currentProviderName;
    }
}
//# sourceMappingURL=client.js.map