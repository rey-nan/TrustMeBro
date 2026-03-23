import { Command } from 'commander';
import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import os from 'os';
import { execSync, spawn } from 'child_process';

// Cross-platform helpers
const isWindows = os.platform() === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

function runNpm(args: string[], options?: { cwd?: string; stdio?: string }) {
  const cmd = isWindows ? 'npm.cmd' : 'npm';
  return execSync(`${cmd} ${args.join(' ')}`, {
    cwd: options?.cwd,
    stdio: options?.stdio as any || 'inherit',
  });
}

function spawnNpm(args: string[], options?: any) {
  return spawn(npmCmd, args, options);
}

function openBrowser(url: string) {
  try {
    if (isWindows) {
      execSync(`start ${url}`, { stdio: 'ignore' });
    } else if (os.platform() === 'darwin') {
      execSync(`open ${url}`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open ${url}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

async function checkApiRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:3000/health', { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function startApiInBackground(rootDir: string): Promise<boolean> {
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  // 1. Check if already running
  try {
    const check = await fetch('http://localhost:3000/health', { signal: AbortSignal.timeout(2000) });
    if (check.ok) return true;
  } catch { /* not running */ }

  // 2. Always build first (ensures fresh code)
  const buildSpinner = ora('Building API (first time may take a minute)...').start();
  try {
    execSync(`${npmCmd} run build:core`, { cwd: rootDir, stdio: 'inherit' });
    execSync(`${npmCmd} run build:api`, { cwd: rootDir, stdio: 'inherit' });
    buildSpinner.succeed('Build complete!');
  } catch {
    buildSpinner.fail('Build failed');
    console.log(chalk.red('\nBuild error. Please run manually:'));
    console.log(chalk.yellow('  npm run build:core'));
    console.log(chalk.yellow('  npm run dev:api'));
    return false;
  }

  // 3. Start API in background
  const apiDist = path.resolve(rootDir, 'packages', 'api', 'dist', 'index.js');

  if (!fs.existsSync(apiDist)) {
    console.log(chalk.red('\nAPI build file not found after build. Please run manually:'));
    console.log(chalk.yellow('  npm run dev:api'));
    return false;
  }

  const apiProcess = spawn('node', [apiDist], {
    cwd: rootDir,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  });
  apiProcess.unref();

  // 4. Wait up to 60 seconds with feedback every 10s
  const spinner = ora('Starting API server...').start();
  const maxWait = 60000;
  const interval = 2000;
  let elapsed = 0;

  while (elapsed < maxWait) {
    await new Promise((r) => setTimeout(r, interval));
    elapsed += interval;

    try {
      const response = await fetch('http://localhost:3000/health', {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        spinner.succeed('API server ready!');
        return true;
      }
    } catch { /* still starting */ }

    if (elapsed % 10000 === 0) {
      spinner.text = `Starting API server... (${elapsed / 1000}s)`;
    }
  }

  spinner.fail('API server took too long to start');
  console.log(chalk.yellow('\nTry starting manually in another terminal:'));
  console.log(chalk.cyan('  npm run dev:api'));
  console.log(chalk.yellow('Then run setup again:'));
  console.log(chalk.cyan('  node setup.js'));
  return false;
}

const PROVIDERS = [
  { id: 'groq', name: '⚡ Groq', description: 'FREE cloud, fastest responses (recommended)', keyUrl: 'https://console.groq.com', isFree: true, needsKey: true },
  { id: 'openrouter', name: '🌐 OpenRouter', description: 'FREE cloud, many model choices', keyUrl: 'https://openrouter.ai/keys', isFree: true, needsKey: true },
  { id: 'openai-compatible', name: '🔧 OpenAI Compatible', description: 'Custom API endpoint', keyUrl: '', isFree: false, needsKey: true },
  { id: 'ollama', name: '🖥  Ollama', description: 'FREE local, runs on your computer (requires install)', keyUrl: 'https://ollama.ai/download', isFree: true, needsKey: false },
];

const OLLAMA_MODELS = [
  { title: 'llama3.2:3b — Small and fast (2GB)', value: 'llama3.2:3b' },
  { title: 'llama3.2:1b — Tiny, very fast (1GB)', value: 'llama3.2:1b' },
  { title: 'mistral:7b — Smarter but slower (4GB)', value: 'mistral:7b' },
];

const GROQ_MODELS = [
  { title: 'llama-3.1-8b-instant — Fast and capable (free)', value: 'llama-3.1-8b-instant' },
  { title: 'llama-3.3-70b-versatile — Smarter (free)', value: 'llama-3.3-70b-versatile' },
  { title: 'gemma2-9b-it — Google model (free)', value: 'gemma2-9b-it' },
];

const OPENROUTER_MODELS = [
  { title: 'deepseek/deepseek-chat — Smart and fast (free)', value: 'deepseek/deepseek-chat' },
  { title: 'meta-llama/llama-3.2-3b-instruct:free — Lightweight (free)', value: 'meta-llama/llama-3.2-3b-instruct:free' },
  { title: 'google/gemini-2.0-flash-exp:free — Google model (free)', value: 'google/gemini-2.0-flash-exp:free' },
];

async function checkOllamaRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function setupOllama(): Promise<boolean> {
  console.log();
  console.log(chalk.bold('📦 Ollama Setup'));
  console.log(chalk.dim('─'.repeat(50)));
  console.log('Ollama runs AI models on your computer for FREE.');
  console.log('No account needed. Your data never leaves your machine.');
  console.log();

  // Check if already running
  if (await checkOllamaRunning()) {
    console.log(chalk.green('✓ Ollama is already running!'));
    return true;
  }

  // Guide installation
  console.log(chalk.yellow('Ollama is not installed or not running.'));
  console.log();

  if (isWindows) {
    console.log('1. Download Ollama from:');
    console.log(chalk.cyan('   https://ollama.ai/download/windows'));
    console.log('2. Run the installer (OllamaSetup.exe)');
    console.log('3. Wait for installation to complete');
    console.log('4. Ollama will start automatically');
    console.log();
    openBrowser('https://ollama.ai/download/windows');
  } else if (os.platform() === 'darwin') {
    console.log('1. Download Ollama from:');
    console.log(chalk.cyan('   https://ollama.ai/download/mac'));
    console.log('2. Open the downloaded file and drag Ollama to Applications');
    console.log('3. Open Ollama from Applications');
    console.log();
    openBrowser('https://ollama.ai/download/mac');
  } else {
    console.log('Run this command to install Ollama:');
    console.log(chalk.cyan('   curl -fsSL https://ollama.ai/install.sh | sh'));
    console.log();
  }

  // Wait for user
  console.log(chalk.dim('After installing Ollama, press Enter to continue...'));
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve());
  });

  // Check again
  if (await checkOllamaRunning()) {
    console.log(chalk.green('✓ Ollama is running!'));
    
    // Download a default model
    console.log();
    const { downloadModel } = await prompts({
      type: 'confirm',
      name: 'downloadModel',
      message: 'Download a small AI model (llama3.2:3b, ~2GB)?',
      initial: true,
    });

    if (downloadModel) {
      const spinner = ora('Downloading llama3.2:3b...').start();
      try {
        execSync('ollama pull llama3.2:3b', { stdio: 'ignore' });
        spinner.succeed('Model downloaded!');
      } catch {
        spinner.fail('Failed to download. Run manually: ollama pull llama3.2:3b');
      }
    }
    return true;
  }

  console.log(chalk.yellow('⚠ Ollama still not running. Please start it manually.'));
  console.log(chalk.dim('Press Enter when ready...'));
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve());
  });

  return await checkOllamaRunning();
}

function getEnvPath(): string {
  return path.join(process.cwd(), '.env');
}

function loadEnv(): Record<string, string> {
  const envPath = getEnvPath();
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) env[match[1].trim()] = match[2].trim();
    }
  }
  return env;
}

function saveEnv(config: Record<string, string>): void {
  const envPath = getEnvPath();
  const existingEnv = loadEnv();
  const merged = { ...existingEnv, ...config };
  const content = Object.entries(merged).map(([key, value]) => `${key}=${value}`).join('\n');
  fs.writeFileSync(envPath, content + '\n');
}

async function validateApiKey(provider: string, apiKey: string, baseUrl: string): Promise<boolean> {
  try {
    let url: string;
    let headers: Record<string, string> = {};
    switch (provider) {
      case 'openrouter':
        url = 'https://openrouter.ai/api/v1/models';
        headers = { 'Authorization': `Bearer ${apiKey}` };
        break;
      case 'ollama':
        url = `${baseUrl || 'http://localhost:11434'}/api/tags`;
        break;
      case 'groq':
        url = 'https://api.groq.com/openai/v1/models';
        headers = { 'Authorization': `Bearer ${apiKey}` };
        break;
      case 'openai-compatible':
        url = `${baseUrl}/models`;
        headers = { 'Authorization': `Bearer ${apiKey}` };
        break;
      default:
        return false;
    }
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function validateTelegram(botToken: string): Promise<{ valid: boolean; chatId?: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
      signal: AbortSignal.timeout(10000),
    });
    const data: any = await response.json();
    return { valid: data.ok === true };
  } catch {
    return { valid: false };
  }
}

async function configureTelegram(): Promise<{ token: string; chatId: string } | null> {
  console.log();
  console.log(chalk.bold('📱 Telegram Setup'));
  console.log(chalk.dim('─'.repeat(50)));
  console.log('Telegram lets you chat with your agents from anywhere.');
  console.log("You'll need to create a bot — it takes about 2 minutes.");
  console.log();

  // Step 1 — Create bot
  console.log(chalk.yellow('Step 1: Create your Telegram bot'));
  console.log(chalk.yellow('─────────────────────────────────'));
  console.log('1. Open Telegram on your phone or computer');
  console.log('2. Search for: ' + chalk.cyan('@BotFather') + ' (the official bot creator)');
  console.log('3. Start a chat and send: ' + chalk.cyan('/newbot'));
  console.log('4. Choose a name for your bot (e.g. "My TrustMeBro")');
  console.log('5. Choose a username ending in ' + chalk.cyan('"bot"') + ' (e.g. "mytrustmebro_bot")');
  console.log('6. BotFather will give you a TOKEN that looks like:');
  console.log(chalk.dim('   123456789:ABCdefGHIjklMNOpqrsTUVwxyz'));
  console.log();

  const { token } = await prompts({
    type: 'text',
    name: 'token',
    message: 'Paste your bot token here:',
    validate: (v: string) => v.includes(':') ? true : 'Invalid token format. It should contain ":"',
  });

  if (!token) return null;

  // Step 2 — Get Chat ID
  console.log();
  console.log(chalk.yellow('Step 2: Get your personal Chat ID'));
  console.log(chalk.yellow('───────────────────────────────────'));
  console.log(chalk.red('⚠ Important: The number in your bot token is the BOT ID, not yours!'));
  console.log(chalk.dim('  Token: 123456789:ABC... → 123456789 is the BOT, not you'));
  console.log();
  console.log('Your Chat ID is YOUR personal Telegram ID. Easiest way to get it:');
  console.log();
  console.log('1. Open Telegram');
  console.log('2. Search for: ' + chalk.cyan('@userinfobot'));
  console.log('3. Start a chat and send any message (e.g. "hi")');
  console.log('4. It will instantly reply with your info, including your ID:');
  console.log(chalk.dim('   Id: 987654321'));
  console.log(chalk.dim('   First: John'));
  console.log(chalk.dim('   ...'));
  console.log();
  console.log(chalk.green('✓ That number next to "Id:" is your Chat ID!'));
  console.log();
  console.log(chalk.dim('Alternative method (if @userinfobot doesn\'t work):'));
  console.log(chalk.dim('1. Send a message to your bot'));
  console.log(chalk.dim(`2. Visit: https://api.telegram.org/bot${token}/getUpdates`));
  console.log(chalk.dim('3. Find "chat":{"id": — that number is your Chat ID'));
  console.log();

  const { chatId } = await prompts({
    type: 'text',
    name: 'chatId',
    message: 'Paste your Chat ID here:',
    validate: (v: string) => /^\d+$/.test(v) ? true : 'Chat ID should be numbers only',
  });

  if (!chatId) return null;

  // Test connection
  const spinner = ora('Testing Telegram connection...').start();
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✅ TrustMeBro connected successfully!\n\nNot Skynet. Probably. 🤖',
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data: any = await response.json();

    if (data.ok) {
      spinner.succeed('Telegram connected! Check your chat for a confirmation message.');
      return { token, chatId };
    } else {
      spinner.fail(`Connection failed: ${data.description}`);
      console.log();
      console.log(chalk.yellow('Common issues:'));
      console.log('- Make sure you sent a message to your bot first');
      console.log('- Check that the token is correct (copy it exactly from BotFather)');
      console.log('- Check that the Chat ID is correct (numbers only)');
      return null;
    }
  } catch {
    spinner.fail('Could not reach Telegram. Check your internet connection.');
    return null;
  }
}

async function createFirstAgent(): Promise<{ agentId: string; agentName: string } | null> {
  console.log();
  console.log(chalk.bold("Let's create your first agent!"));
  console.log(chalk.dim('─'.repeat(50)));
  console.log();

  const agentInfo = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Agent name:',
      validate: (v: string) => v.trim().length > 0 ? true : 'Name is required',
    },
    {
      type: 'text',
      name: 'role',
      message: 'Role/specialty:',
      validate: (v: string) => v.trim().length > 0 ? true : 'Role is required',
    },
    {
      type: 'confirm',
      name: 'generateSoul',
      message: 'Generate personality automatically?',
      initial: true,
    },
  ]);

  if (!agentInfo.name) {
    console.log(chalk.yellow('Skipped agent creation.'));
    return null;
  }

  let soul = null;
  if (agentInfo.generateSoul) {
    const spinner = ora('Generating SOUL...').start();
    try {
      const response = await fetch('http://localhost:3000/api/soul/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: agentInfo.name, role: agentInfo.role }),
        signal: AbortSignal.timeout(30000),
      });
      const data: any = await response.json();
      if (data.success) {
        soul = data.data.soul;
        spinner.succeed('SOUL generated!');
        console.log();
        console.log(chalk.cyan('Personality: ') + (soul.personality || 'N/A').substring(0, 100));
        console.log(chalk.cyan('Expertise:   ') + (soul.expertise?.join(', ') || 'N/A'));
        console.log(chalk.cyan('Values:      ') + (soul.values?.join(', ') || 'N/A'));
        console.log();
      } else {
        spinner.fail('Failed to generate SOUL');
      }
    } catch {
      spinner.fail('Failed to connect to API');
      console.log(chalk.yellow('Make sure the API is running with `npm run dev:api`'));
      return null;
    }
  }

  const { useModel } = await prompts({
    type: 'select',
    name: 'useModel',
    message: 'Which model for this agent?',
    choices: [
      { title: 'Same as default', value: 'default' },
      { title: 'Different model', value: 'custom' },
    ],
    initial: 0,
  });

  let model = '';
  if (useModel === 'custom') {
    const { customModel } = await prompts({ type: 'text', name: 'customModel', message: 'Model name:' });
    model = customModel;
  }

  const { enableWorkspace } = await prompts({
    type: 'confirm',
    name: 'enableWorkspace',
    message: 'Enable workspace (persistent memory)?',
    initial: true,
  });

  const spinner = ora('Creating agent...').start();
  try {
    const env = loadEnv();
    const systemPrompt = soul
      ? `# You are ${soul.name || agentInfo.name}, ${soul.role || agentInfo.role}\n\n## Your Personality\n${soul.personality || '...'}\n\n## Your Expertise\n${soul.expertise?.map((e: string) => `- ${e}`).join('\n') || '- ...'}\n\n## Your Values\n${soul.values?.map((v: string) => `- ${v}`).join('\n') || '- ...'}`
      : `You are ${agentInfo.name}, a ${agentInfo.role}.`;

    const agentId = agentInfo.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
    const response = await fetch('http://localhost:3000/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: agentId,
        name: agentInfo.name,
        description: `A ${agentInfo.role}`,
        systemPrompt,
        model: model || env.LLM_DEFAULT_MODEL || undefined,
        temperature: 0.7,
      }),
    });
    const data: any = await response.json();

    if (data.success) {
      spinner.succeed(`Agent "${agentInfo.name}" created!`);
      return { agentId, agentName: agentInfo.name };
    } else {
      spinner.fail(data.error || 'Failed to create agent');
      return null;
    }
  } catch {
    spinner.fail('Failed to connect to API');
    return null;
  }
}

async function startAgentChat(agentId: string, agentName: string, projectRoot?: string): Promise<void> {
  const rootDir = projectRoot || process.cwd();
  console.log();
  console.log(chalk.cyan('═'.repeat(50)));
  header(`  Chat with ${agentName}`);
  dim("  Type your message below. Type 'exit' to quit.");
  console.log(chalk.cyan('═'.repeat(50)));
  console.log();

  // Keep stdin open
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  // Quick actions (no LLM needed)
  const quickActions: Record<string, string> = {
    'dashboard': 'The dashboard is at: http://localhost:5173',
    'link': 'The dashboard is at: http://localhost:5173\nThe API is at: http://localhost:3000',
    'url': 'The dashboard is at: http://localhost:5173\nThe API is at: http://localhost:3000',
    'onde acesso': 'The dashboard is at: http://localhost:5173',
    'endereco': 'The dashboard is at: http://localhost:5173',
  };

  const matchQuickAction = (input: string): string | null => {
    const lower = input.toLowerCase();
    for (const [key, response] of Object.entries(quickActions)) {
      if (lower.includes(key)) {
        return response;
      }
    }
    return null;
  };

  const waitForTask = async (taskId: string): Promise<string> => {
    const maxWait = 120000;
    const interval = 2000;
    let elapsed = 0;

    while (elapsed < maxWait) {
      try {
        const response = await fetch(`http://localhost:3000/api/tasks/${taskId}`, {
          signal: AbortSignal.timeout(10000),
        });
        const json: any = await response.json();
        const task = json.data || json;

        if (task.status === 'success') {
          return task.output || '(no output)';
        }
        if (task.status === 'failed') {
          throw new Error(task.error || 'Task failed');
        }
      } catch (err: any) {
        if (err.message?.includes('Task failed')) throw err;
      }

      process.stdout.write('.');
      await new Promise((resolve) => setTimeout(resolve, interval));
      elapsed += interval;
    }
    throw new Error('Task timed out');
  };

  const askQuestion = (): void => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.question(chalk.cyan('You: '), async (input) => {
      rl.close();
      const trimmed = input.trim();

      if (!trimmed) {
        askQuestion();
        return;
      }

      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log(chalk.dim('\nGoodbye! Not Skynet. Probably.\n'));
        process.exit(0);
        return;
      }

      // Check for quick actions first (no LLM needed)
      const quickResponse = matchQuickAction(trimmed);
      if (quickResponse) {
        console.log();
        console.log(quickResponse);
        console.log();
        askQuestion();
        return;
      }

      const spinner = ora('Thinking...').start();

      try {
        // Check API first
        if (!(await checkApiRunning())) {
          spinner.fail('API is not running. Starting it...');
          const apiReady = await ensureApiRunning(rootDir);
          if (!apiReady) {
            console.log(chalk.red('\nCould not start API. Run manually:'));
            console.log(chalk.cyan('  node start.js'));
            askQuestion();
            return;
          }
        }

        const response = await fetch('http://localhost:3000/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, input: trimmed }),
        });
        const data: any = await response.json();

        if (!data.success) {
          spinner.fail(data.error || 'Failed to submit task');
          askQuestion();
          return;
        }

        spinner.text = 'Processing';
        const output = await waitForTask(data.data.taskId);
        spinner.stop();

        console.log();
        console.log(output);
        console.log();
      } catch (err) {
        spinner.stop();
        console.log(chalk.red(`\nError: ${(err as Error).message}\n`));
      }

      askQuestion();
    });
  };

  // Start the loop
  askQuestion();

  // Keep process alive forever
  await new Promise(() => {});
}

function header(msg: string): void {
  console.log(chalk.bold(msg));
}

function dim(msg: string): void {
  console.log(chalk.dim(msg));
}

async function ensureApiRunning(rootDir: string): Promise<boolean> {
  // Check if already running
  if (await checkApiRunning()) {
    return true;
  }

  console.log(chalk.yellow('\nAPI is not running. Starting it now...'));

  // Build if needed
  const apiDist = path.resolve(rootDir, 'packages', 'api', 'dist', 'index.js');
  if (!fs.existsSync(apiDist)) {
    console.log(chalk.dim('Building API...'));
    try {
      execSync(`${npmCmd} run build:core`, { cwd: rootDir, stdio: 'ignore' });
      execSync(`${npmCmd} run build:api`, { cwd: rootDir, stdio: 'ignore' });
    } catch {
      console.log(chalk.red('Build failed.'));
      return false;
    }
  }

  // Start API in background (logs to file)
  const dataDir = path.join(rootDir, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const logFile = fs.openSync(path.join(dataDir, 'api.log'), 'a');

  const apiProcess = spawn('node', [apiDist], {
    cwd: rootDir,
    stdio: ['ignore', logFile, logFile],
    detached: true,
    env: { ...process.env },
  });
  apiProcess.unref();

  // Wait up to 30 seconds
  const spinner = ora('Starting API...').start();
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (await checkApiRunning()) {
      spinner.succeed('API ready!');
      return true;
    }
  }

  spinner.fail('API failed to start');
  return false;
}

export function createSetupCommand(): Command {
  const cmd = new Command('setup');
  cmd.description('Interactive setup wizard');
  cmd.option('--telegram', 'Configure Telegram only');
  cmd.option('--skip', 'Skip setup, go straight to chat');

  cmd.action(async (options) => {
    const rootDir = process.cwd();

    // Standalone Telegram configuration
    if (options.telegram) {
      const result = await configureTelegram();
      if (result) {
        saveEnv({
          TELEGRAM_BOT_TOKEN: result.token,
          TELEGRAM_CHAT_ID: result.chatId,
        });
        console.log();
        console.log(chalk.green('✓ ') + 'Telegram configured successfully!');
      } else {
        console.log();
        console.log(chalk.yellow('Telegram setup incomplete. Run ') + chalk.cyan('tmb setup --telegram') + chalk.yellow(' to try again.'));
      }
      return;
    }

    // --skip flag: jump straight to chat
    if (options.skip) {
      const agentsFile = path.resolve(rootDir, 'data', 'agents.json');
      let agents: any[] = [];
      try {
        if (fs.existsSync(agentsFile)) {
          agents = JSON.parse(fs.readFileSync(agentsFile, 'utf-8')) || [];
        }
      } catch {}

      // Ensure API is running
      const apiReady = await ensureApiRunning(rootDir);
      if (!apiReady) {
        console.log(chalk.red('\nCould not start API. Please run manually:'));
        console.log(chalk.cyan('  node start.js'));
        return;
      }

      if (agents.length === 0) {
        console.log(chalk.yellow('\nNo agents yet. You can create one by saying:'));
        console.log(chalk.cyan('"create an agent called [name] that [description]"'));
        console.log();
        await startAgentChat('meta', 'Meta-Agent');
      } else if (agents.length === 1) {
        console.log(chalk.green(`\n✓ Starting chat with ${agents[0].name}...\n`));
        await startAgentChat(agents[0].id, agents[0].name);
      } else {
        // Multiple agents - let user choose
        console.log();
        const { selectedAgent } = await prompts({
          type: 'select',
          name: 'selectedAgent',
          message: 'Which agent do you want to chat with?',
          choices: [
            ...agents.map((a: any) => ({ title: `${a.name} (${a.id})`, value: a.id })),
            { title: '+ Create new agent', value: 'new' },
          ],
        });

        if (selectedAgent === 'new') {
          console.log(chalk.yellow('\nYou can create a new agent by saying:'));
          console.log(chalk.cyan('"create an agent called [name] that [description]"'));
          console.log();
          await startAgentChat('meta', 'Meta-Agent');
        } else if (selectedAgent) {
          const agent = agents.find((a: any) => a.id === selectedAgent);
          console.log(chalk.green(`\n✓ Starting chat with ${agent?.name}...\n`));
          await startAgentChat(selectedAgent, agent?.name || 'Agent');
        }
      }
      return;
    }

    // Check if already configured
    const env = loadEnv();
    const isConfigured = env.LLM_PROVIDER && env.LLM_DEFAULT_MODEL && (env.LLM_API_KEY || env.LLM_PROVIDER === 'ollama');

    if (isConfigured) {
      console.log();
      console.log(chalk.cyan('═'.repeat(50)));
      console.log(chalk.bold('  TrustMeBro Setup'));
      console.log(chalk.cyan('═'.repeat(50)));
      console.log();
      console.log(chalk.green('✓ Already configured!'));
      console.log(chalk.cyan('Provider: ') + env.LLM_PROVIDER);
      console.log(chalk.cyan('Model:    ') + env.LLM_DEFAULT_MODEL);
      console.log();

      const { action } = await prompts({
        type: 'select',
        name: 'action',
        message: 'What do you want to do?',
        choices: [
          { title: 'Chat now (skip setup)', value: 'chat' },
          { title: 'Reconfigure (choose what to change)', value: 'reconfigure' },
          { title: 'Run full setup again', value: 'setup' },
        ],
        initial: 0,
      });

      if (action === 'chat') {
        const agentsFile = path.resolve(rootDir, 'data', 'agents.json');
        let agents: any[] = [];
        try {
          if (fs.existsSync(agentsFile)) {
            agents = JSON.parse(fs.readFileSync(agentsFile, 'utf-8')) || [];
          }
        } catch {}

        const agent = agents[0];
        if (agent) {
          console.log(chalk.green(`\n✓ Starting chat with ${agent.name}...\n`));
          await startAgentChat(agent.id, agent.name);
        } else {
          console.log(chalk.yellow('\nNo agents yet. You can create one by saying:'));
          console.log(chalk.cyan('"create an agent called [name] that [description]"'));
          console.log();
          await startAgentChat('meta', 'Meta-Agent');
        }
        return;
      }

      if (action === 'reconfigure') {
        // Show reconfigure menu
        let keepReconfiguring = true;
        
        while (keepReconfiguring) {
          console.log();
          console.log(chalk.bold('What do you want to change?'));
          console.log(chalk.dim('─'.repeat(40)));
          
          const { whatToChange } = await prompts({
            type: 'select',
            name: 'whatToChange',
            message: 'Select what to reconfigure:',
            choices: [
              { title: 'AI Provider & API Key', value: 'provider' },
              { title: 'Default Model', value: 'model' },
              { title: 'Telegram Integration', value: 'telegram' },
              { title: 'Create new Agent', value: 'agent' },
              { title: 'Done — exit', value: 'done' },
            ],
          });

          if (!whatToChange || whatToChange === 'done') {
            keepReconfiguring = false;
            break;
          }

          if (whatToChange === 'telegram') {
            const telegramResult = await configureTelegram();
            if (telegramResult) {
              saveEnv({
                TELEGRAM_BOT_TOKEN: telegramResult.token,
                TELEGRAM_CHAT_ID: telegramResult.chatId,
              });
              console.log(chalk.green('\n✓ Telegram configured!'));
            }
          } else if (whatToChange === 'agent') {
            await createFirstAgent();
          } else if (whatToChange === 'provider' || whatToChange === 'model') {
            console.log(chalk.yellow('\nFor provider/model changes, run full setup: ') + chalk.cyan('tmb setup'));
          }
        }

        console.log(chalk.green('\n✓ Reconfiguration complete!'));
        console.log(chalk.dim('Restart the API to apply changes: ') + chalk.cyan('node start.js'));
        return;
      }

      // action === 'setup' - continue with full setup below
    }

    // Full setup flow
    console.log();
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.bold('  TrustMeBro Setup'));
    console.log(chalk.dim('  Not Skynet. Probably.'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log();
    console.log(chalk.dim("Welcome! Let's get you up and running."));
    console.log(chalk.dim('This will take about 2 minutes.'));
    console.log();

    let cancelled = false;
    const onCancel = () => {
      cancelled = true;
      console.log(chalk.yellow('\nSetup cancelled. Run `tmb setup` to try again.'));
      return false;
    };

    // Step 1: Provider & API Key
    console.log(chalk.bold('Step 1/5: AI Provider'));
    console.log(chalk.dim('─'.repeat(40)));
    console.log(chalk.dim('Ollama is recommended for beginners — free, private, no account needed.'));
    console.log();
    const { providerChoice } = await prompts({
      type: 'select',
      name: 'providerChoice',
      message: 'Which AI provider do you want to use?',
      choices: PROVIDERS.map((p) => ({
        title: `${p.name} — ${p.description}`,
        value: p.id,
      })),
      initial: 0,
    }, { onCancel });
    if (cancelled) return;
    const provider = PROVIDERS.find((p) => p.id === providerChoice)!;

    console.log();
    console.log(chalk.bold('Step 2/5: Configuration'));
    console.log(chalk.dim('─'.repeat(40)));

    let apiKey = '';
    let baseUrl = '';

    if (provider.id === 'ollama') {
      baseUrl = 'http://localhost:11434';
      // Setup Ollama
      const ollamaReady = await setupOllama();
      if (!ollamaReady) {
        console.log(chalk.yellow('⚠ Ollama is required for this provider.'));
        console.log(chalk.dim('Please install Ollama and run setup again.'));
        return;
      }
    } else if (provider.id === 'groq') {
      console.log(chalk.bold('Get your FREE Groq API key — takes 2 minutes:'));
      console.log();
      console.log(chalk.dim('1. Open: ') + chalk.cyan('https://console.groq.com'));
      console.log(chalk.dim('2. Click "Sign Up" (use Google for fastest signup)'));
      console.log(chalk.dim('3. Click "API Keys" in the left menu'));
      console.log(chalk.dim('4. Click "Create API Key"'));
      console.log(chalk.dim('5. Give it any name (e.g. "TrustMeBro")'));
      console.log(chalk.dim('6. Copy the key shown (starts with "gsk_")'));
      console.log();
      const { key } = await prompts({
        type: 'password',
        name: 'key',
        message: 'Paste your Groq API key:',
        validate: (v: string) => v.trim().length > 0 ? true : 'API key is required',
      }, { onCancel });
      if (cancelled) return;
      apiKey = key;
      baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
    } else if (provider.id === 'openrouter') {
      console.log(chalk.dim('Get your FREE OpenRouter API key:'));
      console.log(chalk.dim('1. Go to: ') + chalk.cyan('https://openrouter.ai/keys'));
      console.log(chalk.dim('2. Sign in with Google'));
      console.log(chalk.dim('3. Click "Create Key"'));
      console.log(chalk.dim('4. Copy the key and paste below'));
      console.log();
      const { key } = await prompts({
        type: 'password',
        name: 'key',
        message: 'API Key:',
        validate: (v: string) => v.trim().length > 0 ? true : 'API key is required',
      }, { onCancel });
      if (cancelled) return;
      apiKey = key;
      baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
    } else {
      // OpenAI Compatible
      const { url } = await prompts({
        type: 'text',
        name: 'url',
        message: 'API Base URL:',
        validate: (v: string) => v.trim().length > 0 ? true : 'URL is required',
      }, { onCancel });
      if (cancelled) return;
      baseUrl = url;
      const { key } = await prompts({
        type: 'password',
        name: 'key',
        message: 'API Key:',
        validate: (v: string) => v.trim().length > 0 ? true : 'API key is required',
      }, { onCancel });
      if (cancelled) return;
      apiKey = key;
    }

    // Validate (skip for Ollama - already checked)
    if (provider.needsKey) {
      const spinnerKey = ora('Validating API key...').start();
      const isValid = await validateApiKey(provider.id, apiKey, baseUrl);
      if (isValid) {
        spinnerKey.succeed('API key validated!');
      } else {
        spinnerKey.fail('API key validation failed');
        const { retry } = await prompts({ type: 'confirm', name: 'retry', message: 'Try again?', initial: true }, { onCancel });
        if (!retry || cancelled) return;
        const spinnerKey2 = ora('Validating API key...').start();
        const isValid2 = await validateApiKey(provider.id, apiKey, baseUrl);
        if (isValid2) {
          spinnerKey2.succeed('API key validated!');
        } else {
          spinnerKey2.fail('API key still invalid. Please check and run setup again.');
          return;
        }
      }
    } else {
      console.log(chalk.green('✓ Ollama ready!'));
    }

    // Step 3: Model
    console.log();
    console.log(chalk.bold('Step 3/5: Default Model'));
    console.log(chalk.dim('─'.repeat(40)));

    let model = '';

    if (provider.id === 'ollama') {
      // List installed models
      try {
        const response = await fetch(`${baseUrl}/api/tags`);
        const data: any = await response.json();
        const installedModels = data.models || [];
        
        if (installedModels.length > 0) {
          console.log(chalk.green(`✓ Found ${installedModels.length} model(s) installed`));
          const { modelChoice } = await prompts({
            type: 'select',
            name: 'modelChoice',
            message: 'Choose a model:',
            choices: [
              ...installedModels.map((m: any) => ({ title: `${m.name} (installed)`, value: m.name })),
              { title: 'Download a recommended model...', value: 'download' },
            ],
          }, { onCancel });
          if (cancelled) return;
          
          if (modelChoice === 'download') {
            const { downloadModel } = await prompts({
              type: 'select',
              name: 'downloadModel',
              message: 'Which model to download?',
              choices: OLLAMA_MODELS,
            }, { onCancel });
            if (cancelled) return;
            
            const spinner = ora(`Downloading ${downloadModel}...`).start();
            try {
              execSync(`ollama pull ${downloadModel}`, { stdio: 'ignore' });
              spinner.succeed('Model downloaded!');
              model = downloadModel;
            } catch {
              spinner.fail('Download failed');
              model = downloadModel;
            }
          } else {
            model = modelChoice;
          }
        } else {
          console.log(chalk.yellow('No models installed yet.'));
          const { downloadModel } = await prompts({
            type: 'select',
            name: 'downloadModel',
            message: 'Download a model:',
            choices: OLLAMA_MODELS,
          }, { onCancel });
          if (cancelled) return;
          
          const spinner = ora(`Downloading ${downloadModel}...`).start();
          try {
            execSync(`ollama pull ${downloadModel}`, { stdio: 'ignore' });
            spinner.succeed('Model downloaded!');
          } catch {
            spinner.fail('Download failed');
          }
          model = downloadModel;
        }
      } catch {
        const { downloadModel } = await prompts({
          type: 'select',
          name: 'downloadModel',
          message: 'Choose a model:',
          choices: OLLAMA_MODELS,
        }, { onCancel });
        if (cancelled) return;
        model = downloadModel;
      }
    } else if (provider.id === 'groq') {
      console.log(chalk.dim('Recommended free models:'));
      const { modelChoice } = await prompts({
        type: 'select',
        name: 'modelChoice',
        message: 'Choose a model:',
        choices: [
          ...GROQ_MODELS,
          { title: 'Custom (type your own)', value: 'custom' },
        ],
        initial: 0,
      }, { onCancel });
      if (cancelled) return;
      if (modelChoice === 'custom') {
        const { customModel } = await prompts({ type: 'text', name: 'customModel', message: 'Model name:' }, { onCancel });
        if (cancelled) return;
        model = customModel;
      } else {
        model = modelChoice;
      }
    } else if (provider.id === 'openrouter') {
      console.log(chalk.dim('Recommended free models:'));
      const { modelChoice } = await prompts({
        type: 'select',
        name: 'modelChoice',
        message: 'Choose a model:',
        choices: [
          ...OPENROUTER_MODELS,
          { title: 'Custom (type your own)', value: 'custom' },
        ],
        initial: 0,
      }, { onCancel });
      if (cancelled) return;
      if (modelChoice === 'custom') {
        const { customModel } = await prompts({ type: 'text', name: 'customModel', message: 'Model name:' }, { onCancel });
        if (cancelled) return;
        model = customModel;
      } else {
        model = modelChoice;
      }
    } else {
      const { customModel } = await prompts({ type: 'text', name: 'customModel', message: 'Model name:' }, { onCancel });
      if (cancelled) return;
      model = customModel;
    }

    // Save configuration
    const spinnerSave = ora('Saving configuration...').start();
    try {
      saveEnv({
        LLM_PROVIDER: provider.id,
        LLM_API_KEY: apiKey,
        LLM_BASE_URL: baseUrl,
        LLM_DEFAULT_MODEL: model,
        PORT: '3000',
        HOST: '0.0.0.0',
        NODE_ENV: 'development',
        API_SECRET_KEY: '',
        ALLOWED_ORIGINS: 'http://localhost:5173',
        DB_PATH: './data/trustmebro.db',
        SANDBOX_TYPE: 'docker',
      });
      spinnerSave.succeed('Configuration saved!');
    } catch {
      spinnerSave.fail('Failed to save configuration');
      return;
    }

    // Step 3.5: Firecrawl (Web Search)
    console.log();
    console.log(chalk.bold('Step 3.5/5: Web Search (Firecrawl)'));
    console.log(chalk.dim('─'.repeat(40)));
    console.log(chalk.dim('Firecrawl enables real web search and content extraction.'));
    console.log(chalk.dim('Options: Self-hosted (free) or Cloud (paid).'));
    console.log();

    const { firecrawlChoice } = await prompts({
      type: 'select',
      name: 'firecrawlChoice',
      message: 'How do you want to use Firecrawl?',
      choices: [
        { title: 'Self-hosted (free) - Run Firecrawl locally via Docker', value: 'selfhost' },
        { title: 'Cloud API (paid) - Use Firecrawl hosted service', value: 'cloud' },
        { title: 'Skip - Configure later', value: 'skip' },
      ],
      initial: 0,
    }, { onCancel });
    if (cancelled) return;

    if (firecrawlChoice === 'selfhost') {
      console.log(chalk.dim('\nTo self-host Firecrawl:'));
      console.log(chalk.cyan('  1. git clone https://github.com/firecrawl/firecrawl.git'));
      console.log(chalk.cyan('  2. cd firecrawl && docker compose up'));
      console.log(chalk.dim('  3. It will run on http://localhost:3002'));
      console.log();

      const { firecrawlUrl } = await prompts({
        type: 'text',
        name: 'firecrawlUrl',
        message: 'Firecrawl URL:',
        initial: 'http://localhost:3002',
      }, { onCancel });
      if (cancelled) return;

      saveEnv({ FIRECRAWL_API_URL: firecrawlUrl });
      console.log(chalk.green('✓ Firecrawl self-hosted configured!'));
    } else if (firecrawlChoice === 'cloud') {
      console.log(chalk.dim('\nGet your API key at: https://firecrawl.dev'));
      console.log();

      const { firecrawlKey } = await prompts({
        type: 'password',
        name: 'firecrawlKey',
        message: 'Firecrawl API Key:',
      }, { onCancel });
      if (cancelled) return;

      saveEnv({ FIRECRAWL_API_KEY: firecrawlKey });
      console.log(chalk.green('✓ Firecrawl cloud configured!'));
    } else {
      console.log(chalk.dim('Skipped. Configure later in .env with:'));
      console.log(chalk.dim('  FIRECRAWL_API_URL=http://localhost:3002 (self-hosted)'));
      console.log(chalk.dim('  FIRECRAWL_API_KEY=fc-xxxxx (cloud)'));
    }

    // Step 4: Create first agent
    console.log();
    console.log(chalk.bold('Step 4/5: Create Your First Agent'));
    console.log(chalk.dim('─'.repeat(40)));

    const { createAgent } = await prompts({
      type: 'confirm',
      name: 'createAgent',
      message: 'Create your first agent now?',
      initial: true,
    }, { onCancel });
    if (cancelled) return;

    let agentId = '';
    let agentName = '';

    if (createAgent) {
      const rootDir = process.cwd();

      // Check if API is running
      let apiRunning = await checkApiRunning();

      if (!apiRunning) {
        console.log();
        console.log(chalk.yellow('Starting API server...'));
        console.log(chalk.dim('This may take a moment on first run.'));
        console.log();

        // Build first (with clean)
        try {
          // Clean old builds
          const coreDist = path.join(rootDir, 'packages', 'core', 'dist');
          const apiDistDir = path.join(rootDir, 'packages', 'api', 'dist');
          if (fs.existsSync(coreDist)) fs.rmSync(coreDist, { recursive: true });
          if (fs.existsSync(apiDistDir)) fs.rmSync(apiDistDir, { recursive: true });

          execSync(`${npmCmd} run build:core`, { cwd: rootDir, stdio: 'inherit' });
          execSync(`${npmCmd} run build:api`, { cwd: rootDir, stdio: 'inherit' });
        } catch {
          console.log(chalk.red('Build failed. Please run manually:'));
          console.log(chalk.cyan('  npm run build:core'));
          console.log(chalk.cyan('  npm run dev:api'));
          return;
        }

        // Start API in background (logs to file, not terminal)
        console.log(chalk.green('✓ Build complete! Starting API...\n'));
        console.log(chalk.dim('API logs: data/api.log\n'));

        // Ensure data/ exists
        const dataDir = path.join(rootDir, 'data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        // Redirect logs to file
        const logFile = fs.openSync(path.join(dataDir, 'api.log'), 'a');

        const apiDist = path.resolve(rootDir, 'packages', 'api', 'dist', 'index.js');
        const apiProcess = spawn('node', [apiDist], {
          cwd: rootDir,
          stdio: ['ignore', logFile, logFile],
          detached: true,
          env: { ...process.env, NODE_ENV: 'production' },
        });
        apiProcess.unref();

        // Wait for API to be ready
        const spinner = ora('Waiting for API...').start();
        let ready = false;
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 1000));
          if (await checkApiRunning()) {
            spinner.succeed('API ready!');
            ready = true;
            break;
          }
        }

        if (!ready) {
          spinner.fail('API failed to start');
          apiProcess.kill();
          return;
        }
      }

      const result = await createFirstAgent();
      if (result) {
        agentId = result.agentId;
        agentName = result.agentName;
      }
    }

    // Step 5: Telegram (optional)
    console.log();
    console.log(chalk.bold('Step 5/5: Telegram Integration (Optional)'));
    console.log(chalk.dim('─'.repeat(40)));

    const { configureTelegramNow } = await prompts({
      type: 'confirm',
      name: 'configureTelegramNow',
      message: 'Connect Telegram for remote access?',
      initial: false,
    }, { onCancel });
    if (cancelled) return;

    if (configureTelegramNow) {
      const telegramResult = await configureTelegram();

      if (!telegramResult) {
        const { retry } = await prompts({
          type: 'confirm',
          name: 'retry',
          message: 'Would you like to try Telegram setup again?',
          initial: false,
        }, { onCancel });

        if (retry && !cancelled) {
          await configureTelegram();
        } else {
          console.log(chalk.dim('\nSkipping Telegram. You can set it up later by running: ') + chalk.cyan('tmb setup --telegram'));
          console.log();
        }
      } else {
        saveEnv({
          TELEGRAM_BOT_TOKEN: telegramResult.token,
          TELEGRAM_CHAT_ID: telegramResult.chatId,
        });
      }
    }

    // Summary & Interface Selection
    console.log();
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.bold('  Setup Complete!'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log();
    console.log(chalk.cyan('Provider: ') + provider.name);
    console.log(chalk.cyan('Model:    ') + model);
    if (agentName) {
      console.log(chalk.cyan('Agent:    ') + agentName);
    }
    console.log();

    console.log(chalk.bold('How would you like to interact with TrustMeBro?'));
    console.log(chalk.dim('─'.repeat(40)));

    const { interactionMode } = await prompts({
      type: 'select',
      name: 'interactionMode',
      message: 'Choose your interface:',
      choices: [
        { title: 'CLI — chat in this terminal right now', value: 'cli' },
        { title: 'Dashboard — web interface at http://localhost:5173', value: 'dashboard' },
        { title: 'Both — CLI + Dashboard together', value: 'both' },
        { title: "Later — I'll decide later", value: 'later' },
      ],
      initial: 0,
    }, { onCancel });
    if (cancelled) return;

    // Execute based on mode
    if (interactionMode === 'cli') {
      // Check for any agents (created now or previously)
      const agentsFile = path.resolve(rootDir, 'data', 'agents.json');
      let existingAgents: any[] = [];
      try {
        if (fs.existsSync(agentsFile)) {
          existingAgents = JSON.parse(fs.readFileSync(agentsFile, 'utf-8')) || [];
        }
      } catch {}

      if (existingAgents.length > 0 || agentId) {
        console.log();
        console.log(chalk.green('✓ Starting chat with your agents...'));
        console.log(chalk.dim('Type your message. Type "exit" to quit.'));
        console.log();
      } else {
        console.log();
        console.log(chalk.yellow('No agents yet. You can create one by saying:'));
        console.log(chalk.cyan('"create an agent called [name] that [description]"'));
        console.log();
      }

      // Start Meta-Agent chat
      await startAgentChat(agentId || 'meta', agentName || 'Meta-Agent');
    } else if (interactionMode === 'dashboard') {
      console.log();
      console.log(chalk.dim('Starting dashboard...'));
      console.log(chalk.dim('API:       ') + chalk.cyan('http://localhost:3000'));
      console.log(chalk.dim('Dashboard: ') + chalk.cyan('http://localhost:5173'));
      console.log();
      console.log(chalk.dim('Run: ') + chalk.cyan('npm run dev'));
      console.log();

      // Try to open browser
      if (openBrowser('http://localhost:5173')) {
        console.log(chalk.dim('Opening browser... ✓'));
      } else {
        console.log(chalk.dim('Open browser manually: ') + chalk.cyan('http://localhost:5173'));
      }
    } else if (interactionMode === 'both') {
      console.log();
      console.log(chalk.dim('Starting everything...'));
      console.log(chalk.dim('Run: ') + chalk.cyan('npm run dev'));
      console.log(chalk.dim('Then open: ') + chalk.cyan('http://localhost:5173'));
      console.log();
      console.log(chalk.dim('You can also chat via CLI: ') + chalk.cyan('tmb meta'));
      console.log();
    } else {
      console.log();
      console.log(chalk.dim('No problem! When you are ready:'));
      console.log();
      console.log(chalk.dim('Start everything: ') + chalk.cyan('npm run dev'));
      console.log(chalk.dim('CLI chat:         ') + chalk.cyan('tmb meta'));
      console.log(chalk.dim('Dashboard only:   ') + chalk.cyan('npm run dev:dashboard'));
      console.log();
    }

    console.log();
    console.log(chalk.green('✓ ') + 'TrustMeBro is ready! Have fun.');
    console.log(chalk.dim('Not Skynet. Probably.'));
    console.log();
  });

  return cmd;
}
