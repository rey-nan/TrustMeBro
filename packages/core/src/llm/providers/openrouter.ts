import type { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from '../types.js';

export class OpenRouterProvider implements LLMProvider {
  name = 'openrouter';
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private defaultModel: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey ?? '';
    this.defaultModel = config.defaultModel ?? 'openai/gpt-3.5-turbo';
  }

  async call(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured. Set LLM_API_KEY in environment.');
    }

    const model = request.model ?? this.defaultModel;

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://trustmebro.dev',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const durationMs = Date.now() - startTime;

    return {
      content: data.choices[0]?.message?.content ?? '',
      model: data.model,
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      provider: this.name,
      durationMs,
    };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
