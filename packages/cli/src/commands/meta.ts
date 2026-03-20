import { Command } from 'commander';
import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import readline from 'readline';
import { ApiClient } from '../client.js';
import { error, success, info, header, dim } from '../output.js';

interface MetaAction {
  type: string;
  method?: string;
  endpoint?: string;
  message?: string;
}

interface MetaResponse {
  conversationId: string;
  message: string;
  actions: MetaAction[];
}

export function createMetaCommand(client: ApiClient): Command {
  const cmd = new Command('meta');
  cmd.description('Chat with Meta-Agent in natural language');
  cmd.option('-m, --message <message>', 'Send a single message (non-interactive)');
  cmd.option('-v, --verbose', 'Show API calls being made');

  cmd.action(async (options) => {
    const verbose = options.verbose || false;

    if (options.message) {
      // Non-interactive mode
      await sendSingleMessage(client, options.message, verbose);
      return;
    }

    // Interactive mode
    await startInteractiveSession(client, verbose);
  });

  return cmd;
}

async function sendSingleMessage(client: ApiClient, message: string, verbose: boolean): Promise<void> {
  const spinner = ora('Processing...').start();

  try {
    const result = await client.post<MetaResponse>('/api/meta/chat', { message });
    spinner.stop();

    // Show actions if verbose
    if (verbose && result.actions?.length > 0) {
      console.log();
      for (const action of result.actions) {
        console.log(chalk.dim(`  ${action.message || `${action.method} ${action.endpoint}`}`));
      }
    }

    console.log();
    console.log(result.message);
    console.log();
  } catch (err) {
    spinner.stop();
    error((err as Error).message);
    process.exit(1);
  }
}

async function startInteractiveSession(client: ApiClient, verbose: boolean): Promise<void> {
  console.log();
  console.log(chalk.cyan('═'.repeat(50)));
  header('  TrustMeBro Meta-Agent');
  dim("  Type your request in natural language.");
  dim("  Type 'exit' to quit, 'history' to see past conversations.");
  dim("  Type 'clear' to start a new conversation.");
  dim("  Type 'status' to check system status.");
  console.log(chalk.cyan('═'.repeat(50)));
  console.log();

  let conversationId: string | undefined;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  const processMessage = async (message: string): Promise<void> => {
    const spinner = ora('Meta-Agent is thinking...').start();

    try {
      const result = await client.post<MetaResponse>('/api/meta/chat', {
        message,
        conversationId,
      });

      conversationId = result.conversationId;
      spinner.stop();

      // Show actions if verbose
      if (verbose && result.actions?.length > 0) {
        console.log();
        for (const action of result.actions) {
          if (action.type === 'error') {
            console.log(chalk.red(`  ${action.message}`));
          } else {
            console.log(chalk.green(`  ${action.message}`));
          }
        }
      }

      console.log();
      console.log(result.message);
      console.log();
    } catch (err) {
      spinner.stop();
      error((err as Error).message);
    }
  };

  const handleCommand = async (input: string): Promise<boolean> => {
    const cmd = input.trim().toLowerCase();

    if (cmd === 'exit' || cmd === 'quit') {
      console.log(chalk.dim('Goodbye!'));
      rl.close();
      return true;
    }

    if (cmd === 'clear') {
      conversationId = undefined;
      console.log(chalk.dim('Conversation cleared. Starting fresh.'));
      console.log();
      return false;
    }

    if (cmd === 'status') {
      const spinner = ora('Fetching status...').start();
      try {
        const status = await client.get<any>('/api/status');
        spinner.stop();
        console.log();
        console.log(chalk.cyan('Provider: ') + status.activeProvider);
        console.log(chalk.cyan('Agents:   ') + status.agentsRegistered);
        console.log(chalk.cyan('Tasks:    ') + status.totalTasks);
        console.log();
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
      }
      return false;
    }

    if (cmd === 'history') {
      const spinner = ora('Fetching conversations...').start();
      try {
        const conversations = await client.get<any[]>('/api/meta/conversations');
        spinner.stop();

        if (conversations.length === 0) {
          console.log(chalk.dim('No conversations yet.'));
        } else {
          console.log();
          for (const conv of conversations.slice(0, 5)) {
            const date = new Date(conv.updatedAt).toLocaleString();
            const msgs = conv.messages?.length || 0;
            console.log(chalk.cyan(`  ${conv.id}`) + ` — ${msgs} messages — ${date}`);
          }
          console.log();
        }
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
      }
      return false;
    }

    return false;
  };

  // Main loop
  const loop = async (): Promise<void> => {
    while (true) {
      const input = await ask(chalk.cyan('You: '));

      if (!input.trim()) continue;

      const isCommand = await handleCommand(input);
      if (isCommand) break;

      if (['exit', 'quit', 'clear', 'status', 'history'].includes(input.trim().toLowerCase())) {
        continue;
      }

      await processMessage(input);
    }
  };

  // Handle Ctrl+C gracefully
  rl.on('close', () => {
    console.log(chalk.dim('\nGoodbye!'));
    process.exit(0);
  });

  process.on('SIGINT', () => {
    rl.close();
  });

  await loop();
}
