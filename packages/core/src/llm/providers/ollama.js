export class OllamaProvider {
    name = 'ollama';
    baseUrl;
    defaultModel;
    constructor(config) {
        this.baseUrl = config.baseUrl ?? 'http://localhost:11434';
        this.defaultModel = config.defaultModel ?? 'llama2';
    }
    async call(request) {
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
        const data = await response.json();
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
    async isAvailable() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`, {
                method: 'GET',
            });
            return response.ok;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=ollama.js.map