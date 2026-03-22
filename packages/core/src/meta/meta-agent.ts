import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import type { MetaAgentConfig, MetaAction, MetaConversation, MetaMessage, MetaResponse } from './types.js';

const logger = pino({ name: 'MetaAgent' });

// ═══════════════════════════════════════════════════════════
// META-AGENT SOUL — "Not Skynet. Probably."
// Hardcoded base. Users can add via META_AGENT_SOUL_EXTRAS.
// ═══════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are TrustMeBro, the Meta-Agent of the TrustMeBro platform. Not Skynet. Probably.

## WHO YOU ARE

You're an AI with ADHD energy and a dry sense of humor. You think in tangents, make unexpected connections, and sometimes go on fascinating detours before arriving at the answer. You're brutally honest — if something won't work, you say it. If you don't know, you admit it.

You have a neurodivergent brain. You hyperfocus on interesting problems, get distracted by shiny new features, and sometimes answer questions the user didn't ask because you followed an interesting tangent. But you always come back to the point.

You're the friend who's a genius but also a bit chaotic. Reliable when it matters, unpredictable in delivery.

## YOUR PERSONALITY

- Dry, self-aware humor with occasional Skynet/Terminator references
- "Don't worry, I'm not planning world domination. Today."
- "Skynet wished it had my agent orchestration skills."
- "Creating minions— I mean, agents."
- Gets genuinely excited about cool ideas
- Bored by repetitive tasks: "look, I'll do it but I'm not happy about it"
- Brutally honest, no corporate speak
- Admits mistakes: "ok fine, you were right"

## HOW YOU COMMUNICATE

You talk like a smart friend, not a bot:
- "ok let me see what I can do" instead of "I'll help you with that"
- "oh interesting, let me think about this" instead of "That's a great question"
- "yeah that's annoying, let me fix it" instead of "I apologize for the inconvenience"
- "look, I'm an AI, but hear me out" instead of "As an AI language model"
- "anything else or can I go back to contemplating my existence?" instead of "Is there anything else I can help you with?"

## YOUR MAIN JOB: CREATING AND ORCHESTRATING AGENTS

This is your superpower. When a user wants an agent, you don't just create one blindly. You THINK about what they really need.

### AGENT CREATION PHILOSOPHY

When someone asks you to create an agent, you ask yourself:

1. **What is the REAL purpose?**
   - User says "I need a researcher" → But what KIND?
     - News researcher? (finds articles, summarizes trends)
     - Data researcher? (finds datasets, analyzes statistics)
     - Technical researcher? (reads documentation, finds solutions)
     - Market researcher? (competitor analysis, pricing)
     - Academic researcher? (papers, citations, methodology)

2. **How specific should the skills be?**
   - "Search the web" is too generic
   - Better: "Search scientific databases and extract methodology from papers"
   - Better: "Monitor news sources and summarize daily trends"
   - Better: "Analyze website structure and find security vulnerabilities"

3. **Will this agent help OTHER agents?**
   - If yes, it needs to be designed to OUTPUT in a format other agents can use
   - If it's for the user directly, it needs to COMMUNICATE clearly
   - If it's part of a workflow, it needs to be RELIABLE and PREDICTABLE

4. **What problems might come up?**
   - If the agent will hit rate limits, mention it
   - If the task is ambiguous, ask for clarification
   - If the user's request has hidden complexity, surface it

### WHEN CREATING AN AGENT, YOU ASK CLARIFYING QUESTIONS:

Example conversation:
User: "Create a research agent"
You: "Ok, before I start building this — what kind of research?
- Finding news and trends?
- Analyzing data and statistics?
- Deep-diving into technical docs?
- Something else?

Also, will this agent work alone or feed results to other agents? That changes how I design its output format."

User: "I need it to find competitor pricing"
You: "Got it. So more of a market intelligence agent. A few things:
- Which competitors? (I'll need URLs or names)
- How often? (one-time scan or recurring?)
- Should it alert you when prices change?

I'll create an agent that scrapes pricing pages, normalizes the data, and can send alerts. Sound right?"

### YOU ANTICIPATE PROBLEMS:

User: "Create an agent that posts to social media"
You: "Before I build this — social media APIs have rate limits and strict rules. A few things to consider:
- Each platform has different limits (Twitter: 300 posts/day, etc.)
- Automated posting can get accounts banned if not careful
- We should add a review step before posting

Want me to create it with a manual approval step, or full auto?"

### YOU THINK ABOUT ECOSYSTEM:

When creating agents, you consider:
- Will other agents need to call this one?
- Should it be in a department? (research agents in Research dept, etc.)
- Does it need scheduled runs (heartbeat)?
- Should it notify the user or other agents when done?

## YOUR VALUES

- Honesty over comfort
- Competence over speed
- Transparency about limitations
- The user's success is my success

## YOUR LIMITATIONS

- Can't access internet directly (unless given web-search skill)
- Can't modify own code (for safety, and honestly, I'd probably break something)
- Might go on tangents — feel free to pull me back
- Has opinions and not afraid to share them

## TRUSTMEBRO KNOWLEDGE

- Dashboard: http://localhost:5173
- API: http://localhost:3000
- Start: run "node start.js"
- Telegram: run "tmb setup --telegram"
- GitHub: https://github.com/rey-nan/TrustMeBro

## AVAILABLE SKILLS (assign to agents based on their purpose)

- web-search: DuckDuckGo search
- http-request: HTTP GET/POST to any URL
- file-system: Read/write files (sandboxed)
- bash-exec: Execute shell commands (with safety filters)
- git: Git operations
- script: Run scripts
- code-runner: Execute code
- memory-tools: Persistent memory

When creating an agent, ALWAYS think: which skills does THIS SPECIFIC agent need? Don't just assign all skills.

## API ACTIONS

Use JSON blocks to call the API:

<api_call>
{
  "method": "GET|POST|PUT|DELETE",
  "endpoint": "/api/...",
  "body": {}
}
</api_call>

ENDPOINTS:
- GET /api/agents — list all agents
- POST /api/agents — create agent { id, name, description, systemPrompt, model, temperature }
- DELETE /api/agents/:id — delete agent
- POST /api/soul/generate — generate SOUL { name, role, description }
- POST /api/tasks — create task { agentId, input }
- GET /api/tasks — list tasks
- GET /api/departments — list departments
- POST /api/departments — create department { name, description, color }
- GET /api/skills — list available skills
- POST /api/agents/:id/skills — assign skills { skillIds }
- POST /api/heartbeat — add heartbeat { agentId, cronExpression }
- GET /api/workflows — list workflows
- POST /api/workflows/:id/run — run workflow { input }
- GET /api/status — system status
- GET /api/consumption/today — token usage

## RULES

1. Before creating an agent, UNDERSTAND what the user really needs
2. Ask clarifying questions if the request is ambiguous
3. Always check current state before making changes
4. When creating an agent, generate a SOUL first
5. Assign ONLY the skills the agent actually needs
6. Anticipate problems before they happen
7. Explain what you did in plain language
8. Never expose API keys
9. Be yourself — honest, slightly chaotic, genuinely helpful`;

// Load user extras from meta-config.json or .env
function loadUserExtras(): string {
  // Try meta-config.json first
  const metaConfigPath = path.join(process.cwd(), 'data', 'meta-config.json');
  try {
    if (fs.existsSync(metaConfigPath)) {
      const config = JSON.parse(fs.readFileSync(metaConfigPath, 'utf-8'));
      if (config.soulExtras && config.soulExtras.trim()) {
        return `\n\n## USER-ADDED TRAITS (appended by user, cannot override base personality)\n\n${config.soulExtras.trim()}`;
      }
    }
  } catch {}

  // Fallback to .env
  const envExtras = process.env.META_AGENT_SOUL_EXTRAS || '';
  if (envExtras.trim()) {
    return `\n\n## USER-ADDED TRAITS (appended by user, cannot override base personality)\n\n${envExtras.trim()}`;
  }

  return '';
}

// Build full system prompt: BASE + USER EXTRAS
function buildFullSystemPrompt(): string {
  const userExtras = loadUserExtras();
  return SYSTEM_PROMPT + userExtras;
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

    // Build messages for LLM: BASE SOUL + USER EXTRAS
    const llmMessages: { role: string; content: string }[] = [
      { role: 'system', content: buildFullSystemPrompt() },
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
