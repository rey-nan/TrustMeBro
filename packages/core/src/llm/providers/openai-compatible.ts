import type { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from '../types.js';

export class OpenAICompatibleProvider implements LLMProvider {
  name = 'openai-compatible';
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey ?? '';
    this.baseUrl = config.baseUrl ?? 'http://localhost:8080/v1';
    this.defaultModel = config.defaultModel ?? 'gpt-3.5-turbo';
  }

  async call(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    if (!this.apiKey) {
      throw new Error('API key not configured. Set LLM_API_KEY in environment.');
    }

    const model = request.model ?? this.defaultModel;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI-compatible API error (${response.status}): ${error}`);
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
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
