import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { ApiClient } from '../client.js';
import { error, success, info, header, dim } from '../output.js';
import { saveConfig, loadConfig, getConfigPath } from '../config.js';

interface SystemStatus {
  version: string;
  uptime: number;
  activeProvider: string;
  agentsRegistered: number;
  totalTasks: number;
}

export function createStatusCommand(client: ApiClient, jsonFlag: boolean): Command {
  const cmd = new Command('status');
  cmd.description('System status and configuration');

  cmd.action(async () => {
    const spinner = ora('Fetching status...').start();
    try {
      const status = await client.get<SystemStatus>('/api/status');
      spinner.stop();

      if (jsonFlag) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }

      const uptimeSeconds = Math.floor(status.uptime / 1000);
      const days = Math.floor(uptimeSeconds / 86400);
      const hours = Math.floor((uptimeSeconds % 86400) / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);

      let uptimeStr = '';
      if (days > 0) uptimeStr += `${days}d `;
      if (hours > 0) uptimeStr += `${hours}h `;
      uptimeStr += `${minutes}m`;

      console.log();
      header('TrustMeBro Status');
      dim('═'.repeat(50));
      console.log(`  ${chalk.cyan('Version')}:         ${status.version}`);
      console.log(`  ${chalk.cyan('Uptime')}:          ${uptimeStr}`);
      console.log(`  ${chalk.cyan('Provider')}:        ${status.activeProvider}`);
      console.log(`  ${chalk.cyan('Agents')}:          ${status.agentsRegistered}`);
      console.log(`  ${chalk.cyan('Total Tasks')}:    ${status.totalTasks}`);
      console.log();
      
      if (status.agentsRegistered === 0) {
        console.log(chalk.yellow('No agents registered yet.'));
        console.log(chalk.dim('Run ') + chalk.cyan('tmb setup') + chalk.dim(' to configure TrustMeBro and create your first agent.'));
        console.log(chalk.dim('Or visit ') + chalk.cyan('http://localhost:5173') + chalk.dim(' to use the dashboard.'));
        console.log();
      }
    } catch (err) {
      spinner.stop();
      error((err as Error).message);
      process.exit(1);
    }
  });

  const configCmd = cmd.command('config').description('Manage CLI configuration');

  configCmd
    .command('set-url')
    .description('Set API URL')
    .action(async (url: string) => {
      try {
        saveConfig({ apiUrl: url });
        success(`API URL set to: ${url}`);
      } catch (err) {
        error((err as Error).message);
        process.exit(1);
      }
    });

  configCmd
    .command('set-key')
    .description('Set API key')
    .action(async (key: string) => {
      try {
        saveConfig({ apiKey: key });
        success('API key saved');
      } catch (err) {
        error((err as Error).message);
        process.exit(1);
      }
    });

  configCmd
    .command('show')
    .description('Show current configuration')
    .action(() => {
      const config = loadConfig();
      console.log();
      header('TrustMeBro CLI Configuration');
      dim('─'.repeat(50));
      console.log(`  ${chalk.cyan('API URL')}:   ${config.apiUrl}`);
      console.log(`  ${chalk.cyan('API Key')}:    ${config.apiKey ? '****' + config.apiKey.slice(-4) : '(not set)'}`);
      console.log(`  ${chalk.cyan('Config')}:     ${getConfigPath()}`);
      console.log();
    });

  return cmd;
}
