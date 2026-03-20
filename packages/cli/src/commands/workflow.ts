import { Command } from 'commander';
import ora from 'ora';
import { ApiClient } from '../client.js';
import { error, success, info, warn, printTable } from '../output.js';

interface Workflow {
  id: string;
  name: string;
  description: string;
  pattern: string;
  steps: Array<{ id: string; agentId: string }>;
  createdAt: number;
}

interface WorkflowRun {
  id: string;
  workflowId: string;
  status: string;
  input: string;
  finalOutput?: string;
  error?: string;
  totalTokens: number;
  startedAt: number;
  completedAt?: number;
}

const PATTERN_COLORS: Record<string, string> = {
  pipeline: '\x1b[38;5;33m',  // blue
  'fan-out': '\x1b[38;5;129m', // purple
  swarm: '\x1b[38;5;214m',    // yellow
  review: '\x1b[38;5;208m',   // orange
};

export function createWorkflowCommand(client: ApiClient): Command {
  const cmd = new Command('workflow');
  cmd.description('Manage workflows');

  cmd
    .command('list')
    .description('List all workflows')
    .action(async () => {
      const spinner = ora('Fetching workflows...').start();
      try {
        const workflows = await client.get<Workflow[]>('/api/workflows');
        spinner.stop();

        if (workflows.length === 0) {
          warn('No workflows found');
          return;
        }

        const rows = workflows.map((w) => [
          w.id,
          w.name,
          w.pattern,
          `${w.steps.length} steps`,
        ]);

        printTable(['ID', 'Name', 'Pattern', 'Steps'], rows);
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('get <id>')
    .description('Get workflow details')
    .action(async (id: string) => {
      const spinner = ora('Fetching workflow...').start();
      try {
        const workflow = await client.get<Workflow>(`/api/workflows/${id}`);
        spinner.stop();

        console.log();
        console.log(`  ID:          ${workflow.id}`);
        console.log(`  Name:        ${workflow.name}`);
        console.log(`  Pattern:     ${workflow.pattern}`);
        console.log(`  Description: ${workflow.description || '-'}`);
        console.log(`  Created:     ${new Date(workflow.createdAt).toLocaleString()}`);
        console.log();
        console.log('  Steps:');
        workflow.steps.forEach((step, i) => {
          console.log(`    ${i + 1}. Agent: ${step.agentId} (${step.id})`);
        });
        console.log();
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('run <id> <input>')
    .description('Run a workflow')
    .action(async (id: string, input: string) => {
      const spinner = ora('Starting workflow...').start();
      try {
        const result = await client.post<{ runId: string }>(`/api/workflows/${id}/run`, {
          input,
        });

        const runId = result.runId;
        spinner.succeed(`Workflow started. Run ID: ${runId}`);

        info('Waiting for completion...');

        let completed = false;
        let attempts = 0;

        while (!completed && attempts < 120) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          
          try {
            const run = await client.get<WorkflowRun>(`/api/workflows/runs/${runId}`);
            
            if (run.status === 'success' || run.status === 'failed') {
              completed = true;
              
              console.log();
              console.log('═'.repeat(50));
              console.log(`Status: ${run.status}`);
              console.log(`Tokens: ${run.totalTokens}`);
              
              if (run.finalOutput) {
                console.log();
                console.log('Output:');
                console.log(run.finalOutput);
              }
              
              if (run.error) {
                console.log();
                console.log('Error:', run.error);
              }
              console.log('═'.repeat(50));
            }
          } catch {
            // Run might not be ready yet
          }
          
          attempts++;
          process.stdout.write('.');
        }

        console.log();
        
        if (!completed) {
          warn(`Workflow still running. Check status with: tmb workflow runs ${id}`);
        }
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('runs <id>')
    .description('Get workflow run history')
    .action(async (id: string) => {
      const spinner = ora('Fetching runs...').start();
      try {
        const runs = await client.get<WorkflowRun[]>(`/api/workflows/${id}/runs`);
        spinner.stop();

        if (runs.length === 0) {
          warn('No runs found');
          return;
        }

        const rows = runs.slice(0, 10).map((r) => [
          r.id.substring(0, 8) + '...',
          r.status,
          r.input.substring(0, 30) + (r.input.length > 30 ? '...' : ''),
          r.totalTokens.toString(),
          new Date(r.startedAt).toLocaleString(),
        ]);

        printTable(['Run ID', 'Status', 'Input', 'Tokens', 'Started'], rows);
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('recent')
    .description('Get recent workflow runs')
    .action(async () => {
      const spinner = ora('Fetching recent runs...').start();
      try {
        const runs = await client.get<WorkflowRun[]>('/api/workflows/runs/recent?limit=10');
        spinner.stop();

        if (runs.length === 0) {
          warn('No recent runs');
          return;
        }

        const rows = runs.map((r) => [
          r.workflowId,
          r.status,
          r.input.substring(0, 30) + (r.input.length > 30 ? '...' : ''),
          new Date(r.startedAt).toLocaleString(),
        ]);

        printTable(['Workflow', 'Status', 'Input', 'Started'], rows);
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
