# TrustMeBro

### Not Skynet. Probably.

Autonomous agent orchestration harness. Run AI agents programmatically, locally or on a server. Model-agnostic. Free to use.

## Quick Start

### Option 1: Guided Setup (recommended)
```bash
git clone https://github.com/rey-nan/TrustMeBro.git
cd TrustMeBro
node setup.js
```

The setup wizard will guide you through:
1. Choosing your LLM provider
2. Configuring your API key
3. Selecting a default model
4. Creating your first agent

### Option 2: Manual Setup
```bash
git clone https://github.com/rey-nan/TrustMeBro.git
cd TrustMeBro
npm install
cp .env.example .env
# Edit .env with your LLM provider settings
npm run build:core
npm run dev
```

### CLI Commands
After setup, use `tmb` (short for `trustmebro`) to interact:
```bash
tmb setup          # Re-run setup wizard
tmb setup --telegram  # Configure Telegram only
tmb status         # Check system status
tmb agent list     # List agents
tmb task run       # Run a task
tmb meta           # Chat with Meta-Agent
tmb workflow list  # List workflows
```

## Telegram Integration (optional)

Chat with your agents from anywhere via Telegram.

### Setup
Run the guided setup:
```bash
tmb setup --telegram
```

Or during initial setup, choose "Yes" when asked about Telegram.

### How it works
1. Create a bot via @BotFather on Telegram
2. The setup wizard guides you through getting your token and chat ID
3. Your agents become accessible via your personal Telegram bot
4. Check your Telegram for a confirmation message when connected

## Providers

- **openrouter** — OpenRouter.ai (free models available)
- **ollama** — Local models via Ollama (zero cost)
- **groq** — Groq API (free tier)
- **openai-compatible** — Any OpenAI-compatible API

## Dashboard

http://localhost:5173

## API

http://localhost:3000

## Environment Variables

```env
# Server
PORT=3000
HOST=0.0.0.0

# LLM Provider
LLM_PROVIDER=openrouter
LLM_API_KEY=your-key
LLM_BASE_URL=
LLM_DEFAULT_MODEL=

# Security
API_SECRET_KEY=

# Storage
DB_PATH=./data/trustmebro.db
```

## Security

Set `API_SECRET_KEY` in `.env` to protect your API instance. All requests (except `/health` and `/api/status`) require the `x-api-key` header.

## CLI Usage

### Install globally
```bash
npm run build:cli
npm link packages/cli
```

### Or run directly
```bash
npm run cli -- <command>
```

### Examples
```bash
tmb status
tmb agent list
tmb agent run my-agent "Create a REST API for user authentication"
tmb task list --status running
tmb knowledge search "JWT authentication error"
tmb heartbeat wake my-agent
tmb dept list
tmb skill list
```

### Configuration
```bash
tmb config set-url http://localhost:3000
tmb config set-key your-api-key
tmb config show
```

## Sandbox

TrustMeBro runs agent code in isolated sandboxes.

### With Docker (recommended)
Install Docker Desktop or Docker Engine (version 20.10+).
The sandbox will automatically pull the required images on first use:
- `node:20-alpine` - for JavaScript/TypeScript
- `python:3.11-alpine` - for Python
- `alpine:latest` - for Bash

### Without Docker
Set `SANDBOX_TYPE=local` in `.env`.
Code runs in isolated child processes with timeout protection.
Less secure but works without Docker.

### Sandbox API Endpoints
```
GET  /api/sandbox/status        - Check Docker availability
POST /api/sandbox/execute       - Execute code in sandbox
POST /api/sandbox/exec-bash     - Execute bash command
POST /api/sandbox/execute-files - Execute with multiple files
GET  /api/sandbox/executions   - List execution history
DELETE /api/sandbox/:id        - Kill a running container
```

## License

MIT
