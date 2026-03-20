import { Command } from 'commander';
import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface SetupConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  interactionMode: string;
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
  const rootDir = process.cwd();
  return path.join(rootDir, '.env');
}

function loadEnv(): Record<string, string> {
  const envPath = getEnvPath();
  const env: Record<string, string> = {};
  
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim();
      }
    }
  }
  
  return env;
}

function saveEnv(config: Record<string, string>): void {
  const envPath = getEnvPath();
  const existingEnv = loadEnv();
  const merged = { ...existingEnv, ...config };
  
  const content = Object.entries(merged)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
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

async function createFirstAgent(): Promise<void> {
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
    return;
  }

  let soul = null;
  if (agentInfo.generateSoul) {
    const spinner = ora('Generating SOUL...').start();
    try {
      const response = await fetch('http://localhost:3000/api/soul/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agentInfo.name,
          role: agentInfo.role,
        }),
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
    const { customModel } = await prompts({
      type: 'text',
      name: 'customModel',
      message: 'Model name:',
    });
    model = customModel;
  }

  const { enableWorkspace } = await prompts({
    type: 'confirm',
    name: 'enableWorkspace',
    message: 'Enable workspace (persistent memory)?',
    initial: true,
  });

  // Create agent
  const spinner = ora('Creating agent...').start();
  try {
    const env = loadEnv();
    const systemPrompt = soul ? 
      `# You are ${soul.name || agentInfo.name}, ${soul.role || agentInfo.role}\n\n## Your Personality\n${soul.personality || '...'}\n\n## Your Expertise\n${soul.expertise?.map((e: string) => `- ${e}`).join('\n') || '- ...'}\n\n## Your Values\n${soul.values?.map((v: string) => `- ${v}`).join('\n') || '- ...'}` :
      `You are ${agentInfo.name}, a ${agentInfo.role}.`;

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
    } else {
      spinner.fail(data.error || 'Failed to create agent');
    }
  } catch {
    spinner.fail('Failed to connect to API');
    return;
  }

  // Test task
  const { testTask } = await prompts({
    type: 'confirm',
    name: 'testTask',
    message: 'Run a test task?',
    initial: true,
  });

  if (testTask) {
    const { taskInput } = await prompts({
      type: 'text',
      name: 'taskInput',
      message: 'Task:',
      initial: 'Say hello!',
    });

    if (taskInput) {
      const spinner = ora('Running task...').start();
      try {
        const agentId = agentInfo.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
        const response = await fetch('http://localhost:3000/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            input: taskInput,
          }),
        });
        const data: any = await response.json();
        
        if (data.success) {
          // Wait a bit and get result
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const result = await fetch(`http://localhost:3000/api/tasks`);
          const tasks: any = await result.json();
          const task = tasks.data?.find((t: any) => t.id === data.data.taskId);
          
          if (task?.output) {
            spinner.succeed('Task completed!');
            console.log();
            console.log(chalk.cyan('Output: ') + task.output.substring(0, 200));
            console.log();
          } else {
            spinner.info('Task submitted (check dashboard for result)');
          }
        } else {
          spinner.fail(data.error || 'Failed to run task');
        }
      } catch {
        spinner.fail('Failed to connect to API');
      }
    }
  }
}

export function createSetupCommand(): Command {
  const cmd = new Command('setup');
  cmd.description('Interactive setup wizard');

  cmd.action(async () => {
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

    // Step 1: Provider
    console.log(chalk.bold('Step 1/4: LLM Provider'));
    console.log(chalk.dim('─'.repeat(40)));
    const { providerChoice } = await prompts({
      type: 'select',
      name: 'providerChoice',
      message: 'Which LLM provider do you want to use?',
      choices: PROVIDERS.map((p, i) => ({
        title: `${p.name} — ${p.description}`,
        value: p.id,
      })),
      initial: 0,
    }, { onCancel });

    if (cancelled) return;
    const provider = PROVIDERS.find(p => p.id === providerChoice)!;

    // Step 2: API Key
    console.log();
    console.log(chalk.bold('Step 2/4: API Key'));
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
    const spinner = ora('Validating API key...').start();
    const isValid = await validateApiKey(provider.id, apiKey, baseUrl);
    if (isValid) {
      spinner.succeed('API key validated!');
    } else {
      spinner.fail('API key validation failed');
      const { retry } = await prompts({
        type: 'confirm',
        name: 'retry',
        message: 'Try again?',
        initial: true,
      }, { onCancel });
      if (!retry || cancelled) return;
      // Retry validation
      const spinner2 = ora('Validating API key...').start();
      const isValid2 = await validateApiKey(provider.id, apiKey, baseUrl);
      if (isValid2) {
        spinner2.succeed('API key validated!');
      } else {
        spinner2.fail('API key still invalid. Please check and run setup again.');
        return;
      }
    }

    // Step 3: Model
    console.log();
    console.log(chalk.bold('Step 3/4: Default Model'));
    console.log(chalk.dim('─'.repeat(40)));

    let model = '';

    if (provider.id === 'openrouter') {
      console.log(chalk.dim('Recommended free models:'));
      const { modelChoice } = await prompts({
        type: 'select',
        name: 'modelChoice',
        message: 'Choose a model:',
        choices: [
          ...OPENROUTER_MODELS.map(m => ({
            title: `${m.name} — ${m.description}`,
            value: m.id,
          })),
          { title: 'Custom (type your own)', value: 'custom' },
        ],
        initial: 0,
      }, { onCancel });
      if (cancelled) return;

      if (modelChoice === 'custom') {
        const { customModel } = await prompts({
          type: 'text',
          name: 'customModel',
          message: 'Model name:',
        }, { onCancel });
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
            choices: models.map((m: any) => ({
              title: m.name,
              value: m.name,
            })),
          }, { onCancel });
          if (cancelled) return;
          model = modelChoice;
        } else {
          console.log(chalk.yellow('No models found. Make sure you have pulled a model:'));
          console.log(chalk.dim('  ollama pull llama2'));
          const { customModel } = await prompts({
            type: 'text',
            name: 'customModel',
            message: 'Model name:',
          }, { onCancel });
          if (cancelled) return;
          model = customModel;
        }
      } catch {
        const { customModel } = await prompts({
          type: 'text',
          name: 'customModel',
          message: 'Model name:',
        }, { onCancel });
        if (cancelled) return;
        model = customModel;
      }
    } else {
      const { customModel } = await prompts({
        type: 'text',
        name: 'customModel',
        message: 'Model name:',
      }, { onCancel });
      if (cancelled) return;
      model = customModel;
    }

    // Step 4: Interaction Mode
    console.log();
    console.log(chalk.bold('Step 4/4: How do you want to use TrustMeBro?'));
    console.log(chalk.dim('─'.repeat(40)));

    const { interactionMode } = await prompts({
      type: 'select',
      name: 'interactionMode',
      message: 'How do you want to interact?',
      choices: [
        { title: 'Dashboard (web interface at http://localhost:5173)', value: 'dashboard' },
        { title: 'CLI (terminal commands with `tmb`)', value: 'cli' },
        { title: 'Both dashboard and CLI', value: 'both' },
        { title: "I'll decide later", value: 'later' },
      ],
      initial: 0,
    }, { onCancel });
    if (cancelled) return;

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
        API_SECRET_KEY: 'your_secret_key_here',
        ALLOWED_ORIGINS: 'http://localhost:5173',
        DB_PATH: './data/trustmebro.db',
        SANDBOX_TYPE: 'docker',
      });
      spinnerSave.succeed('Configuration saved!');
    } catch (err) {
      spinnerSave.fail('Failed to save configuration');
      return;
    }

    // Summary
    console.log();
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.bold('  Setup Complete!'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log();
    console.log(chalk.cyan('Provider: ') + provider.name);
    console.log(chalk.cyan('Model:    ') + model);
    console.log(chalk.cyan('Mode:     ') + interactionMode);
    console.log();

    // Start services based on mode
    if (interactionMode === 'dashboard' || interactionMode === 'both') {
      console.log(chalk.dim('Starting dashboard... run: ') + chalk.cyan('npm run dev'));
      console.log(chalk.dim('Then open: ') + chalk.cyan('http://localhost:5173'));
      console.log();
    }

    if (interactionMode === 'cli' || interactionMode === 'both') {
      console.log(chalk.dim('CLI commands:'));
      console.log(chalk.cyan('  tmb status') + ' — Check system status');
      console.log(chalk.cyan('  tmb agent list') + ' — List agents');
      console.log(chalk.cyan('  tmb task run') + ' — Run a task');
      console.log();
    }

    if (interactionMode === 'later') {
      console.log(chalk.dim('Next steps:'));
      console.log(chalk.cyan('  npm run dev') + ' — Start API + Dashboard');
      console.log(chalk.cyan('  tmb status') + ' — Check CLI status');
      console.log();
    }

    // Create first agent?
    const { createAgent } = await prompts({
      type: 'confirm',
      name: 'createAgent',
      message: 'Create your first agent now?',
      initial: true,
    }, { onCancel });

    if (createAgent && !cancelled) {
      await createFirstAgent();
    }

    console.log();
    console.log(chalk.green('✓ ') + 'TrustMeBro is ready! Have fun.');
    console.log(chalk.dim('Not Skynet. Probably.'));
    console.log();
  });

  return cmd;
}
