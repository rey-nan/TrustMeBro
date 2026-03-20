import pino from 'pino';
import type { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from './types.js';
import { OpenRouterProvider } from './providers/openrouter.js';
import { OllamaProvider } from './providers/ollama.js';
import { GroqProvider } from './providers/groq.js';
import { OpenAICompatibleProvider } from './providers/openai-compatible.js';

export type ProviderName = 'openrouter' | 'ollama' | 'groq' | 'openai-compatible';

const PROVIDERS: Record<ProviderName, new (config: ProviderConfig) => LLMProvider> = {
  'openrouter': OpenRouterProvider,
  'ollama': OllamaProvider,
  'groq': GroqProvider,
  'openai-compatible': OpenAICompatibleProvider,
};

export class LLMClient {
  private provider: LLMProvider;
  private logger: pino.Logger;
  private currentProviderName: ProviderName;

  constructor(logger?: pino.Logger) {
    this.logger = logger ?? pino({ name: 'LLMClient' });

    const providerName = (process.env.LLM_PROVIDER ?? 'openrouter') as ProviderName;
    const config: ProviderConfig = {
      apiKey: process.env.LLM_API_KEY,
      baseUrl: process.env.LLM_BASE_URL,
      defaultModel: process.env.LLM_DEFAULT_MODEL,
    };

    this.currentProviderName = providerName;
    this.provider = this.createProvider(providerName, config);
  }

  private createProvider(name: ProviderName, config: ProviderConfig): LLMProvider {
    const ProviderClass = PROVIDERS[name];
    if (!ProviderClass) {
      throw new Error(`Unknown LLM provider: ${name}. Available: ${Object.keys(PROVIDERS).join(', ')}`);
    }
    return new ProviderClass(config);
  }

  async call(request: LLMRequest): Promise<LLMResponse> {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ provider: this.currentProviderName, error: message }, 'LLM request failed');
      throw error;
    }
  }

  switchProvider(name: ProviderName, config?: Partial<ProviderConfig>): void {
    const newConfig: ProviderConfig = {
      apiKey: config?.apiKey ?? process.env.LLM_API_KEY,
      baseUrl: config?.baseUrl ?? process.env.LLM_BASE_URL,
      defaultModel: config?.defaultModel ?? process.env.LLM_DEFAULT_MODEL,
    };

    this.logger.info({ oldProvider: this.currentProviderName, newProvider: name }, 'Switching LLM provider');
    this.currentProviderName = name;
    this.provider = this.createProvider(name, newConfig);
  }

  async isAvailable(): Promise<boolean> {
    return this.provider.isAvailable();
  }

  getCurrentProvider(): ProviderName {
    return this.currentProviderName;
  }
}
