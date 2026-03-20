import { Command } from 'commander';
import ora from 'ora';
import { ApiClient } from '../client.js';
import { error, success, info, warn, printTable, printTaskResult } from '../output.js';

interface Task {
  id: string;
  agent_id: string;
  input: string;
  status: string;
  output?: string;
  error?: string;
  input_tokens?: number;
  output_tokens?: number;
  duration_ms?: number;
  created_at: number;
  completed_at?: number;
}

interface TasksResponse {
  tasks: Task[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function createTaskCommand(client: ApiClient, jsonFlag: boolean): Command {
  const cmd = new Command('task');
  cmd.description('Manage tasks');

  cmd
    .command('list')
    .description('List tasks')
    .option('--agent <id>', 'Filter by agent ID')
    .option('--status <status>', 'Filter by status (running/success/failed)')
    .option('--limit <n>', 'Number of tasks to show', '20')
    .action(async (options) => {
      const spinner = ora('Fetching tasks...').start();
      try {
        const params = new URLSearchParams();
        if (options.agent) params.set('agentId', options.agent);
        if (options.status) params.set('status', options.status);
        params.set('limit', options.limit);

        const response = await client.get<TasksResponse>(`/api/tasks?${params}`);
        spinner.stop();

        if (jsonFlag) {
          console.log(JSON.stringify(response, null, 2));
          return;
        }

        if (response.tasks.length === 0) {
          warn('No tasks found');
          return;
        }

        const rows = response.tasks.map((t) => [
          t.id.substring(0, 8) + '...',
          t.agent_id.substring(0, 12) + '...',
          t.status,
          t.duration_ms ? `${t.duration_ms}ms` : '-',
          new Date(t.created_at).toLocaleString(),
        ]);

        printTable(['ID', 'Agent', 'Status', 'Duration', 'Created'], rows);
        info(`Showing ${response.tasks.length} of ${response.pagination.total} task(s)`);
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('get <id>')
    .description('Get task details')
    .action(async (id: string) => {
      const spinner = ora('Fetching task...').start();
      try {
        const task = await client.get<Task>(`/api/tasks/${id}`);
        spinner.stop();

        if (jsonFlag) {
          console.log(JSON.stringify(task, null, 2));
          return;
        }

        printTaskResult(task);
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('run <agentId> <input>')
    .description('Create and execute a task')
    .option('--wait', 'Wait for completion')
    .action(async (agentId: string, input: string, options) => {
      const spinner = ora('Creating task...').start();
      try {
        const result = await client.post<{ taskId: string }>('/api/tasks', {
          agentId,
          input,
        });

        const taskId = result.taskId;
        spinner.succeed(`Task created: ${taskId}`);

        if (options.wait) {
          const waitSpinner = ora('Running task...').start();
          let completed = false;
          let attempts = 0;

          while (!completed && attempts < 60) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const taskData = await client.get<Task>(`/api/tasks/${taskId}`);
            attempts++;

            if (taskData.status === 'success' || taskData.status === 'failed') {
              waitSpinner.stop();
              printTaskResult(taskData);
              completed = true;
            }
          }

          if (!completed) {
            warn('Task still running. Check status with: tmb task get ' + taskId);
          }
        } else {
          info(`Task is running. Check status with: tmb task get ${taskId}`);
        }
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('abort <id>')
    .description('Abort a running task')
    .action(async (id: string) => {
      const spinner = ora('Aborting task...').start();
      try {
        await client.post(`/api/tasks/${id}/abort`);
        spinner.stop();
        success('Task aborted');
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
