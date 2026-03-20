import type { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from '../types.js';

export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: ProviderConfig) {
    this.baseUrl = config.baseUrl ?? 'http://localhost:11434';
    this.defaultModel = config.defaultModel ?? 'llama2';
  }

  async call(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    const model = request.model ?? this.defaultModel;

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${error}`);
    }

    const data = await response.json() as {
      message: { content: string };
      model: string;
      total_duration: number;
      prompt_eval_count: number;
      eval_count: number;
    };

    const durationMs = Date.now() - startTime;

    return {
      content: data.message?.content ?? '',
      model: data.model,
      usage: {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      provider: this.name,
      durationMs,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
