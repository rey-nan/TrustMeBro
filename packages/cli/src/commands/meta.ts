import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import * as readline from 'readline';
import { ApiClient } from '../client.js';

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
      await sendSingleMessage(client, options.message, verbose);
      return;
    }

    await startInteractiveChat(client, verbose);
  });

  return cmd;
}

async function sendSingleMessage(client: ApiClient, message: string, verbose: boolean): Promise<void> {
  const spinner = ora('Processing...').start();

  try {
    const result = await client.post<MetaResponse>('/api/meta/chat', { message });
    spinner.stop();

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
    console.error(chalk.red('✗ ') + (err as Error).message);
    process.exit(1);
  }
}

async function startInteractiveChat(client: ApiClient, verbose: boolean): Promise<void> {
  let conversationId: string | undefined;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log(chalk.dim('\n\nGoodbye! Not Skynet. Probably.\n'));
    rl.close();
    process.exit(0);
  });

  console.log();
  console.log(chalk.cyan('═'.repeat(50)));
  console.log(chalk.bold('  TrustMeBro Meta-Agent'));
  console.log(chalk.dim("  Type your message in natural language."));
  console.log(chalk.dim("  Commands: exit, clear, status, history"));
  console.log(chalk.cyan('═'.repeat(50)));
  console.log();

  const askQuestion = (): void => {
    rl.question(chalk.green('You: '), async (input) => {
      const userInput = input.trim();

      // Empty line - ask again
      if (!userInput) {
        askQuestion();
        return;
      }

      // Exit command
      if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
        console.log(chalk.dim('\nGoodbye! Not Skynet. Probably.\n'));
        rl.close();
        process.exit(0);
        return;
      }

      // Clear command
      if (userInput.toLowerCase() === 'clear') {
        conversationId = undefined;
        console.log(chalk.dim('Conversation cleared.\n'));
        askQuestion();
        return;
      }

      // Status command
      if (userInput.toLowerCase() === 'status') {
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
          console.log(chalk.red('Error: ') + (err as Error).message);
        }
        askQuestion();
        return;
      }

      // History command
      if (userInput.toLowerCase() === 'history') {
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
          }
          console.log();
        } catch (err) {
          spinner.stop();
          console.log(chalk.red('Error: ') + (err as Error).message);
        }
        askQuestion();
        return;
      }

      // Process message
      const spinner = ora('Meta-Agent is thinking...').start();
      try {
        const result = await client.post<MetaResponse>('/api/meta/chat', {
          message: userInput,
          conversationId,
        });

        conversationId = result.conversationId;
        spinner.stop();

        // Show actions if verbose
        if (verbose && result.actions?.length > 0) {
          console.log();
          console.log(chalk.dim('Actions taken:'));
          for (const action of result.actions) {
            if (action.type === 'error') {
              console.log(chalk.red(`  ✗ ${action.message}`));
            } else {
              console.log(chalk.green(`  ✓ ${action.message}`));
            }
          }
        }

        console.log();
        console.log(chalk.blue('Meta-Agent: ') + result.message);
        console.log();
      } catch (err) {
        spinner.stop();
        console.log(chalk.red('Error: ') + (err as Error).message);
        console.log();
      }

      // IMPORTANT: Continue the loop
      askQuestion();
    });
  };

  // Start the loop
  askQuestion();

  // Keep process alive
  await new Promise<void>((resolve) => {
    rl.on('close', resolve);
  });
}
