import { Command } from 'commander';
import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import { ApiClient } from '../client.js';
import { error, success, info, warn, printTable, printAgentCard, printTaskResult } from '../output.js';

interface Agent {
  id: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  level?: string;
  departmentId?: string;
  heartbeatCron?: string;
  createdAt?: number;
}

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
}

interface Department {
  id: string;
  name: string;
  agentIds?: string[];
}

export function createAgentCommand(client: ApiClient, jsonFlag: boolean): Command {
  const cmd = new Command('agent');
  cmd.description('Manage agents');

  cmd
    .command('list')
    .description('List all agents')
    .action(async () => {
      const spinner = ora('Fetching agents...').start();
      try {
        const agents = await client.get<Agent[]>('/api/agents');
        spinner.stop();

        if (jsonFlag) {
          console.log(JSON.stringify(agents, null, 2));
          return;
        }

        if (agents.length === 0) {
          warn('No agents found');
          return;
        }

        const rows = agents.map((a) => [
          a.id.substring(0, 12) + '...',
          a.name,
          a.level || '-',
          a.departmentId || '-',
          a.model || '-',
          a.heartbeatCron ? 'active' : '-',
        ]);

        printTable(['ID', 'Name', 'Level', 'Dept', 'Model', 'Heartbeat'], rows);
        info(`Total: ${agents.length} agent(s)`);
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('get <id>')
    .description('Get agent details')
    .action(async (id: string) => {
      const spinner = ora('Fetching agent...').start();
      try {
        const agent = await client.get<Agent>(`/api/agents/${id}`);
        spinner.stop();

        if (jsonFlag) {
          console.log(JSON.stringify(agent, null, 2));
          return;
        }

        printAgentCard(agent);
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('create')
    .description('Create a new agent (interactive wizard)')
    .action(async () => {
      try {
        const departments = await client.get<Department[]>('/api/departments');

        const answers = await prompts([
          {
            type: 'text',
            name: 'id',
            message: 'Agent ID (unique identifier):',
            validate: (v: string) => v.length > 0 || 'ID is required',
          },
          {
            type: 'text',
            name: 'name',
            message: 'Agent name:',
            validate: (v: string) => v.length > 0 || 'Name is required',
          },
          {
            type: 'text',
            name: 'description',
            message: 'Description (optional):',
          },
          {
            type: 'text',
            name: 'role',
            message: 'Role (e.g., developer, analyst):',
          },
          {
            type: 'select',
            name: 'level',
            message: 'Agent level:',
            choices: [
              { title: 'intern', value: 'intern' },
              { title: 'specialist', value: 'specialist' },
              { title: 'lead', value: 'lead' },
            ],
            initial: 1,
          },
          {
            type: 'select',
            name: 'departmentId',
            message: 'Department:',
            choices: [
              { title: 'None', value: '' },
              ...departments.map((d) => ({ title: d.name, value: d.id })),
            ],
          },
          {
            type: 'text',
            name: 'model',
            message: 'Model (e.g., gpt-4, claude-3):',
          },
          {
            type: 'confirm',
            name: 'generateSoul',
            message: 'Generate SOUL automatically?',
            initial: true,
          },
          {
            type: 'confirm',
            name: 'enableHeartbeat',
            message: 'Enable heartbeat?',
            initial: false,
          },
        ]);

        let systemPrompt = '';

        if (answers.generateSoul && answers.name && answers.role) {
          const spinner = ora('Generating SOUL...').start();
          try {
            const result = await client.post<{ soul: unknown; systemPrompt: string }>('/api/soul/generate', {
              name: answers.name,
              role: answers.role,
              description: answers.description,
            });
            systemPrompt = result.systemPrompt;
            spinner.stop();
            success('SOUL generated successfully');
          } catch (err) {
            spinner.stop();
            warn('Failed to generate SOUL: ' + (err as Error).message);
          }
        }

        if (!systemPrompt) {
          systemPrompt = `You are ${answers.name}, a ${answers.level} ${answers.role}. ${answers.description || ''}`;
        }

        const spinner = ora('Creating agent...').start();
        const agent = await client.post<{ id: string }>('/api/agents', {
          id: answers.id,
          name: answers.name,
          description: answers.description || '',
          systemPrompt,
          model: answers.model || undefined,
        });
        spinner.stop();
        success(`Agent created: ${agent.id}`);

        if (answers.enableHeartbeat) {
          try {
            await client.post('/api/heartbeat', {
              agentId: answers.id,
              cronExpression: '*/15 * * * *',
            });
            success('Heartbeat enabled');
          } catch (err) {
            warn('Failed to enable heartbeat: ' + (err as Error).message);
          }
        }

        if (answers.departmentId) {
          try {
            await client.post(`/api/departments/${answers.departmentId}/agents`, {
              agentId: answers.id,
            });
            success('Added to department');
          } catch (err) {
            warn('Failed to add to department: ' + (err as Error).message);
          }
        }
      } catch (err) {
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('delete <id>')
    .description('Delete an agent')
    .action(async (id: string) => {
      const spinner = ora('Fetching agent...').start();
      try {
        const agent = await client.get<Agent>(`/api/agents/${id}`);
        spinner.stop();

        const confirmed = await prompts({
          type: 'confirm',
          name: 'value',
          message: `Delete agent "${agent.name}" (${id})?`,
          initial: false,
        });

        if (!confirmed.value) {
          info('Cancelled');
          return;
        }

        const delSpinner = ora('Deleting agent...').start();
        await client.delete(`/api/agents/${id}`);
        delSpinner.stop();
        success('Agent deleted');
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('run <id> <task>')
    .description('Run a task on an agent')
    .action(async (id: string, task: string) => {
      const spinner = ora('Running task...').start();
      try {
        const result = await client.post<{ taskId: string }>('/api/tasks', {
          agentId: id,
          input: task,
        });

        const taskId = result.taskId;
        let completed = false;
        let attempts = 0;

        while (!completed && attempts < 60) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const taskData = await client.get<Task>(`/api/tasks/${taskId}`);
          attempts++;

          if (taskData.status === 'success' || taskData.status === 'failed') {
            spinner.stop();
            printTaskResult(taskData);
            completed = true;
          }
        }

        if (!completed) {
          spinner.stop();
          warn('Task still running. Check status with: tmb task get ' + taskId);
        }
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('skills <id>')
    .description('List skills assigned to an agent')
    .action(async (id: string) => {
      const spinner = ora('Fetching skills...').start();
      try {
        const skills = await client.get<unknown[]>(`/api/agents/${id}/skills`);
        spinner.stop();

        if (jsonFlag) {
          console.log(JSON.stringify(skills, null, 2));
          return;
        }

        if (skills.length === 0) {
          warn('No skills assigned to this agent');
          return;
        }

        const rows = skills.map((s: unknown) => {
          const skill = s as { id: string; name: string; description?: string };
          return [skill.id, skill.name, skill.description || '-'];
        });

        printTable(['ID', 'Name', 'Description'], rows);
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('assign-skill')
    .description('Assign a skill to an agent')
    .action(async () => {
      try {
        const answers = await prompts([
          {
            type: 'text',
            name: 'agentId',
            message: 'Agent ID:',
          },
          {
            type: 'text',
            name: 'skillId',
            message: 'Skill ID:',
          },
        ]);

        const spinner = ora('Assigning skill...').start();
        await client.post(`/api/agents/${answers.agentId}/skills`, {
          skillId: answers.skillId,
        });
        spinner.stop();
        success('Skill assigned');
      } catch (err) {
        error((err as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
