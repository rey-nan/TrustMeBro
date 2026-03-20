import { Command } from 'commander';
import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import { ApiClient } from '../client.js';
import { error, success, info, warn, printTable, header, dim } from '../output.js';

interface HeartbeatStatus {
  agentId: string;
  cronExpression: string;
  lastRun?: number;
  nextRun?: number;
  isActive: boolean;
}

interface Agent {
  id: string;
  name: string;
  heartbeatCron?: string;
}

export function createHeartbeatCommand(client: ApiClient, jsonFlag: boolean): Command {
  const cmd = new Command('heartbeat');
  cmd.description('Manage agent heartbeats');

  cmd
    .command('list')
    .description('List agents with heartbeat')
    .action(async () => {
      const spinner = ora('Fetching heartbeats...').start();
      try {
        const agents = await client.get<Agent[]>('/api/agents');
        spinner.stop();

        const withHeartbeat = agents.filter((a) => a.heartbeatCron);

        if (jsonFlag) {
          console.log(JSON.stringify(withHeartbeat, null, 2));
          return;
        }

        if (withHeartbeat.length === 0) {
          warn('No agents with heartbeat configured');
          return;
        }

        const rows = withHeartbeat.map((a) => [
          a.id.substring(0, 12) + '...',
          a.name,
          a.heartbeatCron || '-',
        ]);

        printTable(['Agent ID', 'Name', 'Cron'], rows);
        info(`Total: ${withHeartbeat.length} heartbeat(s)`);
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('add <agentId>')
    .description('Register heartbeat for an agent')
    .option('--cron <expression>', 'Cron expression', '*/15 * * * *')
    .action(async (agentId: string, options) => {
      const spinner = ora('Registering heartbeat...').start();
      try {
        await client.post('/api/heartbeat', {
          agentId,
          cronExpression: options.cron,
        });
        spinner.stop();
        success(`Heartbeat registered for ${agentId}`);
        info(`Schedule: ${options.cron}`);
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('remove <agentId>')
    .description('Remove heartbeat from an agent')
    .action(async (agentId: string) => {
      const confirmed = await prompts({
        type: 'confirm',
        name: 'value',
        message: `Remove heartbeat from agent "${agentId}"?`,
        initial: false,
      });

      if (!confirmed.value) {
        info('Cancelled');
        return;
      }

      const spinner = ora('Removing heartbeat...').start();
      try {
        await client.delete(`/api/heartbeat/${agentId}`);
        spinner.stop();
        success('Heartbeat removed');
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('wake <agentId>')
    .description('Force immediate heartbeat wake')
    .action(async (agentId: string) => {
      const spinner = ora('Triggering heartbeat...').start();
      try {
        const result = await client.post<{ wakeInitiated: boolean }>(`/api/heartbeat/${agentId}/wake`);
        spinner.stop();

        if (result.wakeInitiated) {
          success(`Heartbeat triggered for ${agentId}`);
          info('Agent should execute its scheduled task');
        } else {
          warn('Heartbeat not configured for this agent');
        }
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('status <agentId>')
    .description('Get heartbeat status for an agent')
    .action(async (agentId: string) => {
      const spinner = ora('Fetching status...').start();
      try {
        const status = await client.get<HeartbeatStatus & { recentLogs: unknown[] }>(
          `/api/heartbeat/${agentId}/status`
        );
        spinner.stop();

        if (jsonFlag) {
          console.log(JSON.stringify(status, null, 2));
          return;
        }

        console.log();
        header(`Heartbeat Status: ${agentId}`);
        dim('─'.repeat(50));
        console.log(`  Cron:      ${status.cronExpression}`);
        console.log(`  Active:    ${status.isActive ? 'Yes' : 'No'}`);
        if (status.lastRun) {
          console.log(`  Last Run:  ${new Date(status.lastRun).toLocaleString()}`);
        }
        if (status.nextRun) {
          console.log(`  Next Run:  ${new Date(status.nextRun).toLocaleString()}`);
        }

        if (status.recentLogs && status.recentLogs.length > 0) {
          console.log();
          info('Recent Logs:');
          status.recentLogs.forEach((log: unknown) => {
            const l = log as { created_at: number; status: string; output?: string };
            console.log(`  ${new Date(l.created_at).toLocaleString()} - ${l.status}`);
            if (l.output) {
              console.log(chalk.gray(`    ${l.output.substring(0, 100)}`));
            }
          });
        }
        console.log();
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
