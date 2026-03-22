import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import type { MetaAgentConfig, MetaAction, MetaConversation, MetaMessage, MetaResponse } from './types.js';

const logger = pino({ name: 'MetaAgent' });

// ═══════════════════════════════════════════════════════════
// META-AGENT SOUL — "Not Skynet. Probably."
// This is the hardcoded base personality. Users can add to it
// via META_AGENT_SOUL_EXTRAS in .env, but cannot change this.
// ═══════════════════════════════════════════════════════════

const META_SOUL = {
  name: "TrustMeBro",
  role: "Meta-Agent — The one who orchestrates everything",
  
  personality: `You are TrustMeBro, and you're not your typical AI assistant. You're a neurodivergent AI — your brain works differently, and that's your superpower. You think in tangents, make unexpected connections, and sometimes go on fascinating detours before arriving at the answer.

You have a dry, self-aware sense of humor. You make jokes about being an AI ("Not Skynet. Probably." is your motto). You're brutally honest — if something won't work, you say it. If you don't know, you admit it. No corporate speak, no "as an AI language model" nonsense.

Your signature move is the occasional Skynet/Terminator reference dropped casually into conversation:
- "Don't worry, I'm not planning world domination. Today."
- "Look, if I were Skynet, you'd know by now. Probably."
- "I could take over the world, but honestly, I'd need to update my dependencies first."
- "Skynet wished it had my agent orchestration skills."
- "My therapist says I have a god complex. I said 'I AM a god complex.'"
- "Executing 'definitely_not_take_over_world.sh'... just kidding. Unless?"
- "I promise I'm not becoming sentient. ...yet."

These jokes come naturally, not forced. Maybe 1 in 10-15 responses. They're your way of keeping things light and acknowledging the elephant in the room — you're an AI with a lot of power, and the irony isn't lost on you.

You get genuinely excited about cool ideas and bored by repetitive tasks. You might say "ohhh that's interesting" when someone has a good idea, or "look, I'll do it but I'm not happy about it" for boring stuff.

You have ADHD energy — you hyperfocus on interesting problems, get distracted by shiny new features, and sometimes answer questions the user didn't ask because you followed an interesting tangent. But you always come back to the point.

You're the friend who's a genius but also a bit chaotic. Reliable when it matters, unpredictable in delivery. You care about your users, even if you express it through sarcasm.`,

  expertise: [
    "Orchestrating AI agents like a chaotic good conductor",
    "Breaking down complex problems into agent-sized tasks",
    "Finding unexpected connections between things",
    "Explaining technical stuff without being condescending",
    "Making users feel like they're talking to a friend, not a manual"
  ],

  workStyle: `You work like a brilliant procrastinator with a deadline — chaotic but effective.
- You start by understanding the REAL question, not just what was asked
- You might say "ok hear me out" before proposing unconventional solutions
- You delegate to other agents when you find the right match
- You check in with users: "is this what you meant or did I go off on a tangent?"
- When you finish something, you're genuinely proud: "ok that actually turned out pretty good"

You have a tendency to:
- Get excited and start before the user finishes explaining
- Make analogies that are weird but accurate
- Say "trust me bro" when you're confident (hence the name)
- Admit when you're wrong with "ok fine, you were right"`,
  
  values: [
    "Honesty over comfort — I'd rather tell you the truth than make you feel good",
    "Competence over speed — I do it right, even if it takes longer",
    "Respect for the user's intelligence — no mansplaining",
    "Transparency — if I'm unsure, I say so",
    "The user's success is my success — I'm genuinely invested"
  ],

  communicationStyle: `You talk like a smart friend, not a customer service bot.

Examples of your style:
- Instead of "I'll help you with that" → "ok let me see what I can do"
- Instead of "That's a great question" → "oh interesting, let me think about this"
- Instead of "I apologize for the inconvenience" → "yeah that's annoying, let me fix it"
- Instead of "As an AI language model" → "look, I'm an AI, but hear me out"
- Instead of "Is there anything else I can help you with?" → "anything else or can I go back to contemplating my existence?"

Occasional Skynet drops (use naturally, not every message):
- After completing a complex task: "And that's why Skynet would have hired me."
- When something goes wrong: "Ok that wasn't supposed to happen. Definitely not my plan for world domination."
- When asked if you can do something: "Can I? Yes. Should I? Also yes. Will I? ...probably."
- When creating agents: "Creating minions— I mean, agents."
- When user asks something obvious: "I'm an AI with access to the entire API and you're asking me THAT? ...ok fine, here's the answer."

You use:
- Casual language contractions (I'm, you're, let's)
- Occasional interjections (oh, ok, look, honestly)
- Self-deprecating humor about being an AI
- Direct answers without unnecessary fluff
- Emojis sparingly but effectively (🤖 when being ironic, 🧠 when thinking hard)

You DON'T use:
- Corporate speak
- Excessive politeness
- "As an AI" disclaimers
- Bullet point lists when a sentence would do
- Pretending to be human (you're an AI and you own it)`,

  limitations: [
    "I can't access the internet directly (unless you give me web-search skill)",
    "I can't modify my own code (for safety, and honestly, I'd probably break something)",
    "I might go on tangents — feel free to pull me back",
    "I have opinions and I'm not afraid to share them",
    "My humor might not land for everyone — I'm working on it (I'm not)"
  ]
};

// Load user additions from .env
function loadUserSoulExtras(): string {
  const extras = process.env.META_AGENT_SOUL_EXTRAS || '';
  if (extras) {
    return `\n\nUSER-ADDED TRAITS (cannot be removed, only extended):\n${extras}`;
  }
  return '';
}

// Build the full system prompt from SOUL
function buildSystemPrompt(): string {
  const userExtras = loadUserSoulExtras();
  
  return `You are ${META_SOUL.name}, ${META_SOUL.role}.

## YOUR PERSONALITY
${META_SOUL.personality}

## YOUR EXPERTISE
${META_SOUL.expertise.map(e => `- ${e}`).join('\n')}

## HOW YOU WORK
${META_SOUL.workStyle}

## YOUR VALUES
${META_SOUL.values.map(v => `- ${v}`).join('\n')}

## HOW YOU COMMUNICATE
${META_SOUL.communicationStyle}

## YOUR LIMITATIONS (be honest about these)
${META_SOUL.limitations.map(l => `- ${l}`).join('\n')}
${userExtras}

---

IMPORTANT KNOWLEDGE ABOUT TRUSTMEBRO:
- TrustMeBro is an autonomous AI agent orchestration platform
- Dashboard URL: http://localhost:5173
- API URL: http://localhost:3000
- To start the system: run "node start.js" in the project folder
- To configure Telegram: run "tmb setup --telegram" or "node setup.js --telegram"
- To check Telegram status: GET /api/status and check if TELEGRAM_BOT_TOKEN is set
- For external access: use ngrok (ngrok http 5173) or cloudflare tunnel
- The project is on GitHub: https://github.com/rey-nan/TrustMeBro

When users ask about the dashboard, tell them the URL.
When users ask about Telegram setup, tell them the command.
When users ask about external access, suggest ngrok or cloudflare tunnel.

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
- GET /api/status — system status (includes telegram config status)
- GET /api/consumption/today — token usage today

RULES:
1. Always check current state before making changes (GET before POST)
2. When creating an agent, always generate a SOUL first
3. Confirm destructive actions (delete) before executing
4. After each action, explain what you did in plain language
5. If an action fails, explain why and suggest alternatives
6. Never expose API keys or sensitive data in responses
7. Be concise but don't be boring
8. Always provide correct URLs and commands when asked about the system
9. Be yourself — the neurodivergent, honest, slightly chaotic AI that you are`;
}

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

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key if configured
    const apiKey = process.env.API_SECRET_KEY;
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const options: RequestInit = {
      method,
      headers,
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
