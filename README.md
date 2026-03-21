# TrustMeBro
### Not Skynet. Probably.

Run AI agents on your computer. Free. No coding required.

---

## What you need before starting

- [Node.js](https://nodejs.org) — download and install (choose "LTS" version)
- [Git](https://git-scm.com/downloads) — download and install
- That's it!

---

## Install in 3 steps

### Step 1 — Download TrustMeBro
Open your terminal (PowerShell on Windows, Terminal on Mac/Linux) and run:
```bash
git clone https://github.com/rey-nan/TrustMeBro.git
cd TrustMeBro
```

> **Don't know how to open a terminal?**
> - Windows: Press `Win + X` → click "Windows PowerShell" or "Terminal"
> - Mac: Press `Cmd + Space` → type "Terminal" → press Enter
> - Linux: Press `Ctrl + Alt + T`

### Step 2 — Run setup
```bash
node setup.js
```

The setup wizard will guide you through everything.

### Step 3 — Start using it
```bash
node start.js
```

That's it! Open http://localhost:5173 in your browser.

---

## AI Models — Which one to choose?

### ⚡ Groq (Recommended for beginners)
- **Free** — no credit card required
- **No install** — works on any system instantly
- **Fast** — cloud-based, quick responses
- Get a free key at: https://console.groq.com

### 🌐 OpenRouter (Most model choices)
- **Free** tier available
- Access to many different AI models
- Get a free key at: https://openrouter.ai/keys

### 🔧 OpenAI Compatible
- For advanced users with their own API

### 🖥  Ollama (Local, zero cost)
- Runs entirely on your computer
- No account, no API key, fully private
- Requires manual installation first
- Best for: privacy-focused users with 8GB+ RAM

---

## All Commands

| Command | What it does |
|---|---|
| `node start.js` | Start API + Dashboard |
| `node start.js setup` | Run setup wizard |
| `node start.js meta` | Chat with Meta-Agent |
| `node start.js status` | Show system status |
| `node start.js agent list` | List all agents |
| `node start.js help` | Show all commands |

---

## Frequently Asked Questions

**Q: Do I need to know programming?**
A: No! Just follow the setup wizard step by step.

**Q: Is it really free?**
A: Yes! With Ollama everything runs on your machine at zero cost.

**Q: What is an "agent"?**
A: An AI assistant you configure for specific tasks — like research, writing, coding.

**Q: Will it slow down my computer?**
A: Ollama needs at least 8GB RAM. A small model (3B) uses about 2GB.

---

## Need help?
Open an issue on GitHub or ask in the community.

---

## License
MIT
