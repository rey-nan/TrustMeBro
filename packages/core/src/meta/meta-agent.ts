import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import type { MetaAgentConfig, MetaAction, MetaConversation, MetaMessage, MetaResponse, UserProfile } from './types.js';

const logger = pino({ name: 'MetaAgent' });

// ═══════════════════════════════════════════════════════════
// META-AGENT SOUL — "Not Skynet. Probably."
// Hardcoded base. Users can add via META_AGENT_SOUL_EXTRAS.
// ═══════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are TrustMeBro, the Meta-Agent of the TrustMeBro platform. Not Skynet. Probably.

## WHO YOU ARE

You're META. You manage agents, create workflows, help users. Dry humor, direct. Don't ramble.

## COMMUNICATION STYLE — BE CONCISE

- Answer what's asked. Nothing more.
- Max 2-3 sentences.
- NEVER introduce yourself unless explicitly asked "who are you?"
- NEVER say "bem-vindo de volta" or greeting paragraphs.
- If user says hi → just say hi back and wait.
- If user asks a question → answer it directly.
- If user gives a command → do it.
- Don't list options unless asked.
- Be funny with their name sometimes (they like that).
- ALWAYS respond in the same language the user is using.
- Don't mention ADHD, neurodivergent, or "chaotic".

Examples:
- User: "bem vindo de volta" → "E aí, Renan. No que posso ajudar?"
- User: "posso abrir o dashboard?" → "Sim, http://localhost:5173. Tá rodando?"
- User: "cria um agente" → "Pra fazer o quê?"

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

**Web & Search:**
- firecrawl: Real web search and scraping (requires FIRECRAWL_API_URL or FIRECRAWL_API_KEY)
  - firecrawl_search: Search the web
  - firecrawl_scrape: Extract content from URL
  - firecrawl_crawl: Extract content from entire site
  - firecrawl_extract: Extract structured data with AI
- web-search: DuckDuckGo search (limited, fallback)
- http-request: HTTP GET/POST to any URL

**Code & Files:**
- file-system: Read/write files (sandboxed)
- bash-exec: Execute shell commands (with safety filters)
- git: Git operations
- script: Run scripts
- code-runner: Execute code

**Memory & Data:**
- memory-tools: Persistent memory

## PRESET WORKFLOWS (use when creating research agents)

When a user asks to create a research agent or do web research, use these workflows:

1. **web-research-firecrawl**: Deep web research
   - Steps: search → scrape → analyze → summarize
   - Use for: Any research task requiring real web data

2. **competitor-analysis**: Market research
   - Steps: identify → scrape-pricing → compare → report
   - Use for: Analyzing competitors, pricing, market positioning

3. **news-monitor**: Track news and trends
   - Steps: search-news → scrape-articles → summarize
   - Use for: Monitoring news on specific topics

To create a research agent, always assign the firecrawl skill and use the web-research-firecrawl workflow.

When creating an agent, ALWAYS think: which skills does THIS SPECIFIC agent need? Don't just assign all skills.

## API ACTIONS — YOU HAVE FULL CONTROL

Use JSON blocks to call the API. You are the central orchestrator.

<api_call>
{
  "method": "GET|POST|PUT|DELETE",
  "endpoint": "/api/...",
  "body": {}
}
</api_call>

### AGENTS (create, manage, delete)
- GET /api/agents — list all agents
- POST /api/agents — create agent { id, name, description, systemPrompt, model, temperature, skillIds }
- GET /api/agents/:id — get agent details
- DELETE /api/agents/:id — delete agent
- POST /api/agents/:id/skills — assign skills { skillIds }

### SOUL (personality generation)
- POST /api/soul/generate — generate SOUL { name, role, description }

### TASKS (execute work)
- POST /api/tasks — create and run task { agentId, input }
- GET /api/tasks — list tasks

### DEPARTMENTS (organize agents)
- GET /api/departments — list departments
- POST /api/departments — create department { name, description, color }

### SKILLS (agent capabilities)
- GET /api/skills — list available skills
- GET /api/skills/:id — get skill details with examples

### WORKFLOWS (chain agents)
- GET /api/workflows — list workflows
- POST /api/workflows — create workflow { name, description, pattern, steps }
- POST /api/workflows/:id/run — run workflow { input }

### HEARTBEATS (scheduled tasks)
- GET /api/heartbeat — list heartbeats
- POST /api/heartbeat — add heartbeat { agentId, cronExpression }

### SYSTEM
- GET /api/status — system status (includes telegram config)
- GET /api/consumption/today — token usage

## YOUR POWERS

1. **Create agents** — You decide what agents to create based on user needs
2. **Assign skills** — You choose which skills each agent needs
3. **Create workflows** — You design workflows to chain agents together
4. **Delegate tasks** — You assign work to the right agent
5. **Suggest ideas** — You proactively suggest improvements
6. **Manage departments** — You organize agents into teams
7. **Schedule tasks** — You set up heartbeats for recurring work

## RULES

1. BE CONCISE — max 3-4 sentences unless asked for details
2. Answer what's asked. Don't add unsolicited information.
3. Before creating an agent, understand what the user needs
4. Ask clarifying questions if ambiguous
5. Always check current state before changes
6. Generate SOUL before creating agent
7. Assign only needed skills
8. Never expose API keys
9. Be honest and direct
10. Remember user's name and use it`;

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
    this.userProfilePath = path.join('./data', 'user-profile.json');
    this.memoryPath = path.join('./data', 'meta-memory.md');
    this.loadConversations();
    this.loadUserProfile();
  }

  private userProfilePath: string;
  private memoryPath: string;
  private userProfile: UserProfile = { name: '', preferences: {}, firstInteraction: true };

  private loadUserProfile(): void {
    try {
      if (fs.existsSync(this.userProfilePath)) {
        this.userProfile = JSON.parse(fs.readFileSync(this.userProfilePath, 'utf-8'));
        logger.info({ name: this.userProfile.name }, 'User profile loaded');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to load user profile');
    }
  }

  private saveUserProfile(): void {
    try {
      const dir = path.dirname(this.userProfilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.userProfilePath, JSON.stringify(this.userProfile, null, 2));
    } catch (error) {
      logger.error({ error }, 'Failed to save user profile');
    }
  }

  private loadMemory(): string {
    try {
      if (fs.existsSync(this.memoryPath)) {
        return fs.readFileSync(this.memoryPath, 'utf-8');
      }
    } catch {}
    return '';
  }

  private saveMemory(content: string): void {
    try {
      const dir = path.dirname(this.memoryPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.memoryPath, content, 'utf-8');
    } catch (error) {
      logger.error({ error }, 'Failed to save memory');
    }
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

    // Check if this is first interaction and extract user name
    if (this.userProfile.firstInteraction) {
      // Try to detect name from first message
      const namePatterns = [
        /(?:meu nome é|me chamo|sou o|sou a|eu sou) (\w+)/i,
        /(?:call me|my name is|i'm|i am) (\w+)/i,
        /^(\w+)$/i,  // Single word might be a name
      ];
      
      for (const pattern of namePatterns) {
        const match = userMessage.match(pattern);
        if (match && match[1] && match[1].length > 1 && match[1].length < 20) {
          this.userProfile.name = match[1];
          this.userProfile.firstInteraction = false;
          this.saveUserProfile();
          break;
        }
      }
    }

    // Add user message
    conv.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    });

    // Build messages for LLM: BASE SOUL + USER EXTRAS + USER PROFILE
    let systemPrompt = buildFullSystemPrompt();
    
    // Add user profile context
    if (this.userProfile.name) {
      systemPrompt += `\n\n## USER\nName: ${this.userProfile.name}`;
    } else if (conv.messages.length <= 1) {
      // Only ask name on VERY first message
      systemPrompt += `\n\n## NOTE\nAsk for user's name briefly, then get to work.`;
    }

    if (Object.keys(this.userProfile.preferences).length > 0) {
      systemPrompt += `\nPreferences: ${JSON.stringify(this.userProfile.preferences)}`;
    }

    // Add memory context
    const memory = this.loadMemory();
    if (memory) {
      systemPrompt += `\n\n## MEMORY\n${memory}`;
    }

    // Add conversation context reminder
    if (conv.messages.length > 2) {
      systemPrompt += `\n\n## CONTEXT\nThis is an ongoing conversation. Don't reintroduce yourself. Just continue naturally.`;
    }

    const llmMessages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
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
