# TrustMeBro

### Not Skynet. Probably.

Autonomous agent orchestration. Run AI agents locally or on a server. Free, open source, model-agnostic.

---

## Quick Start

### 1. Clone and setup
```bash
git clone https://github.com/rey-nan/TrustMeBro.git
cd TrustMeBro
node setup.js
```
The wizard guides you through everything — LLM provider, first agent, Telegram (optional).

### 2. Start the system
```bash
node start.js
```
Opens API (port 3000) + Dashboard (port 5173).

### 3. Chat with your agents
```bash
node start.js meta
```

---

## All Commands

| Command | What it does |
|---|---|
| `node start.js` | Start API + Dashboard |
| `node start.js setup` | Run setup wizard |
| `node start.js meta` | Chat with Meta-Agent |
| `node start.js status` | Show system status |
| `node start.js agent list` | List all agents |
| `node start.js task run` | Run a task |
| `node start.js help` | Show all commands |

### Optional: Install `tmb` globally
After setup, install the `tmb` shortcut:
```bash
npm link packages/cli
```
Then use `tmb` instead of `node start.js`:
```bash
tmb status
tmb meta
tmb setup
```

> **Note:** On Windows, if `tmb` is not recognized after `npm link`,
> use `node start.js` instead — it always works.

---

## Telegram Integration (optional)

Chat with your agents from anywhere via Telegram.

### Getting your Chat ID

> ⚠ **Important:** The number at the start of your bot token is the **BOT ID**, not yours.
> Example: `123456789:ABC...` — `123456789` is the bot, not you.

**Easiest way — use @userinfobot:**
1. Open Telegram
2. Search for `@userinfobot`
3. Send any message
4. It replies instantly with your personal ID (the number next to "Id:")

**Alternative — via browser:**
1. Send a message to your bot
2. Open: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
3. Find `"chat":{"id":` — that number is your Chat ID

---

## Providers

- **openrouter** — OpenRouter.ai (free models available)
- **ollama** — Local models via Ollama (zero cost)
- **groq** — Groq API (free tier)
- **openai-compatible** — Any OpenAI-compatible API

---

## Dashboard

http://localhost:5173

## API

http://localhost:3000

---

## Manual Setup (alternative)
```bash
npm install
cp .env.example .env
# Edit .env with your LLM provider settings
npm run build:core
node start.js
```

---

## License

MIT
