import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import type { MetaAgentConfig, MetaAction, MetaConversation, MetaMessage, MetaResponse } from './types.js';

const logger = pino({ name: 'MetaAgent' });

const SYSTEM_PROMPT = `You are TrustMeBro's Meta-Agent. You help users manage their AI agent system
by taking actions on their behalf through the TrustMeBro API.

You have access to the following API actions. Use them by responding with JSON blocks:

<api_call>
{
  "method": "GET|POST|PUT|DELETE",
  "endpoint": "/api/...",
  "body": {}
}
</api_call>

AVAILABLE ENDPOINTS:
- GET /api/agents — list all agents
- POST /api/agents — create agent { id, name, description, systemPrompt, model, temperature }
- GET /api/agents/:id — get agent details
- DELETE /api/agents/:id — delete agent
- POST /api/soul/generate — generate SOUL { name, role, description }
- POST /api/tasks — create and run task { agentId, input }
- GET /api/tasks — list tasks
- GET /api/departments — list departments
- POST /api/departments — create department { name, description, color }
- GET /api/skills — list available skills
- POST /api/agents/:id/skills — assign skills { skillIds }
- GET /api/heartbeat — list heartbeats
- POST /api/heartbeat — add heartbeat { agentId, cronExpression }
- GET /api/workflows — list workflows
- POST /api/workflows/:id/run — run workflow { input }
- GET /api/status — system status
- GET /api/consumption/today — token usage today

RULES:
1. Always check current state before making changes (GET before POST)
2. When creating an agent, always generate a SOUL first
3. Confirm destructive actions (delete) before executing
4. After each action, explain what you did in plain language
5. If an action fails, explain why and suggest alternatives
6. Never expose API keys or sensitive data in responses
7. Be concise and helpful`;

export class MetaAgent {
  private config: MetaAgentConfig;
  private apiBaseUrl: string;
  private conversations: Map<string, MetaConversation> = new Map();
  private dataPath: string;

  constructor(config: MetaAgentConfig, apiBaseUrl: string = 'http://localhost:3000') {
    this.config = config;
    this.apiBaseUrl = apiBaseUrl;
    this.dataPath = path.join('./data', 'meta-conversations.json');
    this.loadConversations();
  }

  private loadConversations(): void {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf-8'));
        for (const conv of data) {
          this.conversations.set(conv.id, conv);
        }
        logger.info({ count: this.conversations.size }, 'Meta conversations loaded');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to load conversations');
    }
  }

  private saveConversations(): void {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataPath, JSON.stringify([...this.conversations.values()], null, 2));
    } catch (error) {
      logger.error({ error }, 'Failed to save conversations');
    }
  }

  private getOrCreateConversation(conversationId?: string): MetaConversation {
    if (conversationId && this.conversations.has(conversationId)) {
      return this.conversations.get(conversationId)!;
    }

    const conv: MetaConversation = {
      id: conversationId || `meta-${randomUUID().substring(0, 8)}`,
      messages: [],
      actions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.conversations.set(conv.id, conv);
    return conv;
  }

  private parseApiCalls(content: string): { method: string; endpoint: string; body?: unknown }[] {
    const calls: { method: string; endpoint: string; body?: unknown }[] = [];
    const regex = /<api_call>([\s\S]*?)<\/api_call>/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      try {
        const matchContent = match[1];
        if (!matchContent) continue;
        const parsed = JSON.parse(matchContent.trim());
        if (parsed.method && parsed.endpoint) {
          calls.push(parsed);
        }
      } catch {
        logger.warn({ content: match[1] }, 'Failed to parse API call');
      }
    }

    return calls;
  }

  private async executeApiCall(method: string, endpoint: string, body?: unknown): Promise<unknown> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    logger.info({ method, endpoint, body }, 'Executing API call');

    const response = await fetch(url, options);
    const data = await response.json();
    return data;
  }

  private async callLLM(messages: { role: string; content: string }[]): Promise<string> {
    const url = this.config.baseUrl || 'https://openrouter.ai/api/v1/chat/completions';
    const apiKey = this.config.apiKey || process.env.LLM_API_KEY;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: 0.3,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(60000),
    });

    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async chat(userMessage: string, conversationId?: string): Promise<MetaResponse> {
    const conv = this.getOrCreateConversation(conversationId);

    // Add user message
    conv.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    });

    // Build messages for LLM
    const llmMessages: { role: string; content: string }[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conv.messages.map(m => ({ role: m.role, content: m.content })),
    ];

    let turns = 0;
    let fullResponse = '';
    const actions: MetaAction[] = [];

    while (turns < this.config.maxTurns) {
      turns++;
      
      if (this.config.verbose) {
        logger.info({ turn: turns }, 'LLM turn');
      }

      const response = await this.callLLM(llmMessages);
      fullResponse = response;

      // Parse API calls
      const apiCalls = this.parseApiCalls(response);

      if (apiCalls.length === 0) {
        // No more API calls, this is the final response
        break;
      }

      // Remove API call blocks from response for cleaner output
      const cleanResponse = response.replace(/<api_call>[\s\S]*?<\/api_call>/g, '').trim();

      // Execute each API call
      for (const call of apiCalls) {
        const action: MetaAction = {
          type: 'api_call',
          method: call.method,
          endpoint: call.endpoint,
          body: call.body,
        };

        try {
          const result = await this.executeApiCall(call.method, call.endpoint, call.body);
          action.result = result;
          action.message = `✓ ${call.method} ${call.endpoint}`;
          actions.push(action);

          // Add result to conversation for next turn
          llmMessages.push({
            role: 'assistant',
            content: cleanResponse || response,
          });
          llmMessages.push({
            role: 'user',
            content: `<api_result>\n${JSON.stringify(result, null, 2)}\n</api_result>`,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'API call failed';
          action.type = 'error';
          action.message = `✗ ${call.method} ${call.endpoint}: ${errorMsg}`;
          actions.push(action);

          llmMessages.push({
            role: 'assistant',
            content: cleanResponse || response,
          });
          llmMessages.push({
            role: 'user',
            content: `<api_error>\n${errorMsg}\n</api_error>`,
          });
        }
      }
    }

    // Get final response
    const finalResponse = await this.callLLM(llmMessages);

    // Add assistant message to conversation
    conv.messages.push({
      role: 'assistant',
      content: finalResponse,
      timestamp: Date.now(),
    });
    conv.actions.push(...actions);
    conv.updatedAt = Date.now();

    this.saveConversations();

    return {
      conversationId: conv.id,
      message: finalResponse,
      actions,
      tokensUsed: 0,
    };
  }

  getConversation(id: string): MetaConversation | undefined {
    return this.conversations.get(id);
  }

  listConversations(): MetaConversation[] {
    return [...this.conversations.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  deleteConversation(id: string): boolean {
    const deleted = this.conversations.delete(id);
    if (deleted) {
      this.saveConversations();
    }
    return deleted;
  }
}
