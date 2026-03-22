#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig } from './config.js';
import { ApiClient } from './client.js';
import { createAgentCommand } from './commands/agent.js';
import { createTaskCommand } from './commands/task.js';
import { createHeartbeatCommand } from './commands/heartbeat.js';
import { createKnowledgeCommand } from './commands/knowledge.js';
import { createSkillCommand } from './commands/skill.js';
import { createDeptCommand } from './commands/dept.js';
import { createStatusCommand } from './commands/status.js';
import { createWorkflowCommand } from './commands/workflow.js';
import { createSetupCommand } from './commands/setup.js';
import { createMetaCommand } from './commands/meta.js';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

const VERSION = '0.1.0';

function showBanner(): void {
  console.log();
  console.log(chalk.cyan('TrustMeBro') + chalk.gray(' v' + VERSION));
  console.log(chalk.dim('Not Skynet. Probably.'));
  console.log();
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('trustmebro')
    .description('TrustMeBro CLI - Autonomous AI agent orchestration harness')
    .version(VERSION)
    .option('--json', 'Output in JSON format')
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.opts();
      const globalOpts = program.opts();
      
      (globalOpts as { json?: boolean }).json = opts.json;
    });

  const config = loadConfig();
  const client = new ApiClient(config);
  const jsonFlag = false;

  // Check if setup is needed
  const needsSetup = (): boolean => {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return true;
    const content = fs.readFileSync(envPath, 'utf-8');
    return !content.includes('LLM_API_KEY=') || content.includes('LLM_API_KEY=\n') || content.includes('LLM_API_KEY=your_api_key_here');
  };

  // Register setup command first
  program.addCommand(createSetupCommand());

  // Add first-time check for other commands (skip if running setup)
  program.hook('preAction', (thisCommand) => {
    const args = process.argv.slice(2);
    const isSetupCommand = args.includes('setup');
    
    if (!isSetupCommand && needsSetup()) {
      console.log();
      console.log(chalk.yellow("Looks like TrustMeBro isn't configured yet."));
      console.log(chalk.dim("Run '") + chalk.cyan('tmb setup') + chalk.dim("' to get started."));
      console.log();
      process.exit(0);
    }
  });

  program.addCommand(createAgentCommand(client, jsonFlag));
  program.addCommand(createTaskCommand(client, jsonFlag));
  program.addCommand(createHeartbeatCommand(client, jsonFlag));
  program.addCommand(createKnowledgeCommand(client, jsonFlag));
  program.addCommand(createSkillCommand(client, jsonFlag));
  program.addCommand(createDeptCommand(client, jsonFlag));
  program.addCommand(createStatusCommand(client, jsonFlag));
  program.addCommand(createWorkflowCommand(client));
  program.addCommand(createMetaCommand(client));

  program.on('command:*', () => {
    console.error(chalk.red(`Invalid command: ${program.args.join(' ')}`));
    console.error(chalk.dim(`Run '${program.name()} --help' for available commands`));
    process.exit(1);
  });

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error(chalk.red('Error:'), (err as Error).message);
    process.exit(1);
  }
}

showBanner();
main().catch((err) => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});
