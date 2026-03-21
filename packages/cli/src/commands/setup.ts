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
  const apiDist = path.resolve(rootDir, 'packages', 'api', 'dist', 'index.js');

  // 1. Build API if needed
  if (!fs.existsSync(apiDist)) {
    const buildSpinner = ora('Building API...').start();
    try {
      runNpm(['run', 'build:core'], { cwd: rootDir });
      runNpm(['run', 'build:api'], { cwd: rootDir });
      buildSpinner.succeed('API built!');
    } catch {
      buildSpinner.fail('Failed to build API');
      return false;
    }
  }

  // 2. Check if already running
  if (await checkApiRunning()) {
    return true;
  }

  // 3. Start API in background
  const spinner = ora('Starting API server...').start();

  const apiProcess = spawn('node', [apiDist], {
    cwd: rootDir,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  });

  apiProcess.unref();

  // 4. Wait for API to be ready (up to 30 seconds)
  const maxWait = 30000;
  const interval = 1000;
  let elapsed = 0;

  while (elapsed < maxWait) {
    await new Promise((r) => setTimeout(r, interval));
    elapsed += interval;

    if (await checkApiRunning()) {
      spinner.succeed('API server started on http://localhost:3000');
      return true;
    }
    spinner.text = `Starting API server... (${elapsed / 1000}s)`;
  }

  spinner.fail('API server took too long to start');
  return false;
}

const PROVIDERS = [
  { id: 'openrouter', name: 'OpenRouter', description: 'Free models available', keyUrl: 'https://openrouter.ai/keys' },
  { id: 'ollama', name: 'Ollama', description: 'Local — zero cost', keyUrl: 'https://ollama.ai' },
  { id: 'groq', name: 'Groq', description: 'Free tier — fast inference', keyUrl: 'https://console.groq.com' },
  { id: 'openai-compatible', name: 'OpenAI Compatible', description: 'Any OpenAI-compatible API', keyUrl: '' },
];

const OPENROUTER_MODELS = [
  { id: 'deepseek/deepseek-chat', name: 'deepseek/deepseek-chat', description: 'Smart and fast' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', description: 'Large free model' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', description: 'Google free model' },
];

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

async function startAgentChat(agentId: string, agentName: string): Promise<void> {
  console.log();
  console.log(chalk.cyan('═'.repeat(50)));
  header(`  Chat with ${agentName}`);
  dim("  Type your message below. Type 'exit' to quit.");
  console.log(chalk.cyan('═'.repeat(50)));
  console.log();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  const waitForTask = async (taskId: string): Promise<string> => {
    const maxWait = 120000;
    const interval = 2000;
    let elapsed = 0;

    while (elapsed < maxWait) {
      const response = await fetch(`http://localhost:3000/api/tasks/${taskId}`, {
        signal: AbortSignal.timeout(10000),
      });
      const task: any = await response.json();

      if (task.status === 'success') return task.output || '(no output)';
      if (task.status === 'failed') throw new Error(task.error || 'Task failed');

      process.stdout.write('.');
      await new Promise((resolve) => setTimeout(resolve, interval));
      elapsed += interval;
    }
    throw new Error('Task timed out');
  };

  while (true) {
    const input = await ask(chalk.cyan('You: '));

    if (!input.trim()) continue;
    if (input.trim().toLowerCase() === 'exit' || input.trim().toLowerCase() === 'quit') {
      console.log(chalk.dim('Goodbye!'));
      rl.close();
      return;
    }

    const spinner = ora('Thinking...').start();

    try {
      const response = await fetch('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, input }),
      });
      const data: any = await response.json();

      if (!data.success) {
        spinner.fail(data.error || 'Failed to submit task');
        continue;
      }

      spinner.text = 'Processing';
      const output = await waitForTask(data.data.taskId);
      spinner.stop();

      console.log();
      console.log(output);
      console.log();
    } catch (err) {
      spinner.stop();
      console.log(chalk.red(`Error: ${(err as Error).message}`));
    }
  }
}

function header(msg: string): void {
  console.log(chalk.bold(msg));
}

function dim(msg: string): void {
  console.log(chalk.dim(msg));
}

export function createSetupCommand(): Command {
  const cmd = new Command('setup');
  cmd.description('Interactive setup wizard');
  cmd.option('--telegram', 'Configure Telegram only');

  cmd.action(async (options) => {
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
    console.log(chalk.bold('Step 1/5: LLM Provider'));
    console.log(chalk.dim('─'.repeat(40)));
    const { providerChoice } = await prompts({
      type: 'select',
      name: 'providerChoice',
      message: 'Which LLM provider do you want to use?',
      choices: PROVIDERS.map((p) => ({
        title: `${p.name} — ${p.description}`,
        value: p.id,
      })),
      initial: 0,
    }, { onCancel });
    if (cancelled) return;
    const provider = PROVIDERS.find((p) => p.id === providerChoice)!;

    console.log();
    console.log(chalk.bold('Step 2/5: API Key & Model'));
    console.log(chalk.dim('─'.repeat(40)));

    let apiKey = '';
    let baseUrl = '';

    if (provider.id === 'ollama') {
      console.log(chalk.dim('Make sure Ollama is running: ') + chalk.cyan(provider.keyUrl));
      const response = await prompts({
        type: 'text',
        name: 'baseUrl',
        message: 'Ollama URL:',
        initial: 'http://localhost:11434',
      }, { onCancel });
      if (cancelled) return;
      baseUrl = response.baseUrl;
    } else {
      if (provider.keyUrl) {
        console.log(chalk.dim('Get your free key at: ') + chalk.cyan(provider.keyUrl));
      }
      if (provider.id === 'openai-compatible') {
        const { url } = await prompts({
          type: 'text',
          name: 'url',
          message: 'API Base URL:',
          validate: (v: string) => v.trim().length > 0 ? true : 'URL is required',
        }, { onCancel });
        if (cancelled) return;
        baseUrl = url;
      }
      const { key } = await prompts({
        type: 'password',
        name: 'key',
        message: 'API Key:',
        validate: (v: string) => v.trim().length > 0 ? true : 'API key is required',
      }, { onCancel });
      if (cancelled) return;
      apiKey = key;
    }

    // Validate key
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

    // Step 3: Model
    console.log();
    console.log(chalk.bold('Step 3/5: Default Model'));
    console.log(chalk.dim('─'.repeat(40)));

    let model = '';

    if (provider.id === 'openrouter') {
      console.log(chalk.dim('Recommended free models:'));
      const { modelChoice } = await prompts({
        type: 'select',
        name: 'modelChoice',
        message: 'Choose a model:',
        choices: [
          ...OPENROUTER_MODELS.map((m) => ({ title: `${m.name} — ${m.description}`, value: m.id })),
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
    } else if (provider.id === 'ollama') {
      try {
        const response = await fetch(`${baseUrl}/api/tags`);
        const data: any = await response.json();
        const models = data.models || [];
        if (models.length > 0) {
          const { modelChoice } = await prompts({
            type: 'select',
            name: 'modelChoice',
            message: 'Choose a model:',
            choices: models.map((m: any) => ({ title: m.name, value: m.name })),
          }, { onCancel });
          if (cancelled) return;
          model = modelChoice;
        } else {
          console.log(chalk.yellow('No models found. Make sure you have pulled a model:'));
          console.log(chalk.dim('  ollama pull llama2'));
          const { customModel } = await prompts({ type: 'text', name: 'customModel', message: 'Model name:' }, { onCancel });
          if (cancelled) return;
          model = customModel;
        }
      } catch {
        const { customModel } = await prompts({ type: 'text', name: 'customModel', message: 'Model name:' }, { onCancel });
        if (cancelled) return;
        model = customModel;
      }
    } else {
      const { customModel } = await prompts({ type: 'text', name: 'customModel', message: 'Model name:' }, { onCancel });
      if (cancelled) return;
      model = customModel;
    }

    // Save configuration BEFORE creating agent
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
        API_SECRET_KEY: 'your_secret_key_here',
        ALLOWED_ORIGINS: 'http://localhost:5173',
        DB_PATH: './data/trustmebro.db',
        SANDBOX_TYPE: 'docker',
      });
      spinnerSave.succeed('Configuration saved!');
    } catch {
      spinnerSave.fail('Failed to save configuration');
      return;
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
      const apiRunning = await checkApiRunning();

      if (!apiRunning) {
        console.log(chalk.dim('API is not running. Starting it now...'));
        const started = await startApiInBackground(rootDir);

        if (!started) {
          console.log(chalk.yellow('\n⚠ Could not start API automatically.'));
          console.log('Please run in another terminal: ' + chalk.cyan('npm run dev:api'));
          console.log('Then run: ' + chalk.cyan('tmb setup'));
          console.log();
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
      if (agentId) {
        await startAgentChat(agentId, agentName);
      } else {
        console.log(chalk.yellow('No agent created. Start the API and create one first.'));
        console.log(chalk.dim('Run: ') + chalk.cyan('npm run dev:api'));
        console.log(chalk.dim('Then: ') + chalk.cyan('tmb setup'));
      }
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
