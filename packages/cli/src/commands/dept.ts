import { Command } from 'commander';
import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import { ApiClient } from '../client.js';
import { error, success, info, warn, printTable, header, dim } from '../output.js';

interface Department {
  id: string;
  name: string;
  description?: string;
  color?: string;
  leadAgentId?: string;
  agentIds?: string[];
}

interface Agent {
  id: string;
  name: string;
  level?: string;
}

export function createDeptCommand(client: ApiClient, jsonFlag: boolean): Command {
  const cmd = new Command('dept');
  cmd.description('Manage departments');

  cmd
    .command('list')
    .description('List all departments')
    .action(async () => {
      const spinner = ora('Fetching departments...').start();
      try {
        const departments = await client.get<Department[]>('/api/departments');
        spinner.stop();

        if (jsonFlag) {
          console.log(JSON.stringify(departments, null, 2));
          return;
        }

        if (departments.length === 0) {
          warn('No departments found');
          return;
        }

        const rows = departments.map((d) => [
          d.id,
          d.name,
          d.description?.substring(0, 30) + (d.description && d.description.length > 30 ? '...' : '') || '-',
          d.color || '-',
          d.agentIds?.length.toString() || '0',
        ]);

        printTable(['ID', 'Name', 'Description', 'Color', 'Agents'], rows);
        info(`Total: ${departments.length} department(s)`);
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('create')
    .description('Create a department')
    .action(async () => {
      try {
        const answers = await prompts([
          {
            type: 'text',
            name: 'id',
            message: 'Department ID:',
            validate: (v: string) => /^[a-z0-9-]+$/.test(v) || 'Use lowercase letters, numbers, and hyphens',
          },
          {
            type: 'text',
            name: 'name',
            message: 'Department name:',
          },
          {
            type: 'text',
            name: 'description',
            message: 'Description (optional):',
          },
          {
            type: 'text',
            name: 'color',
            message: 'Color (hex, e.g., #00ff88):',
            initial: '#00ff88',
          },
        ]);

        const spinner = ora('Creating department...').start();
        const dept = await client.post<Department>('/api/departments', {
          id: answers.id,
          name: answers.name,
          description: answers.description || '',
          color: answers.color,
        });
        spinner.stop();
        success(`Department created: ${dept.id}`);
      } catch (err) {
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('get <id>')
    .description('Get department details')
    .action(async (id: string) => {
      const spinner = ora('Fetching department...').start();
      try {
        const dept = await client.get<Department>(`/api/departments/${id}`);
        spinner.stop();

        if (jsonFlag) {
          console.log(JSON.stringify(dept, null, 2));
          return;
        }

        console.log();
        header(`Department: ${dept.name}`);
        dim('─'.repeat(50));
        console.log(`  ${chalk.cyan('ID')}:          ${dept.id}`);
        console.log(`  ${chalk.cyan('Name')}:        ${dept.name}`);
        if (dept.description) {
          console.log(`  ${chalk.cyan('Description')}: ${dept.description}`);
        }
        console.log(`  ${chalk.cyan('Color')}:       ${dept.color || '-'}`);
        if (dept.leadAgentId) {
          console.log(`  ${chalk.cyan('Lead Agent')}:  ${dept.leadAgentId}`);
        }
        console.log(`  ${chalk.cyan('Agents')}:      ${dept.agentIds?.length || 0}`);
        if (dept.agentIds && dept.agentIds.length > 0) {
          console.log(`               ${dept.agentIds.join(', ')}`);
        }
        console.log();
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('agents <id>')
    .description('List agents in a department')
    .action(async (id: string) => {
      const spinner = ora('Fetching agents...').start();
      try {
        const dept = await client.get<Department & { agents: Agent[] }>(`/api/departments/${id}`);
        spinner.stop();

        if (jsonFlag) {
          console.log(JSON.stringify(dept.agents || [], null, 2));
          return;
        }

        if (!dept.agents || dept.agents.length === 0) {
          warn('No agents in this department');
          return;
        }

        const rows = dept.agents.map((a) => [
          a.id,
          a.name,
          a.level || '-',
        ]);

        printTable(['ID', 'Name', 'Level'], rows);
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('add-agent')
    .description('Add an agent to a department')
    .action(async () => {
      try {
        const answers = await prompts([
          {
            type: 'text',
            name: 'deptId',
            message: 'Department ID:',
          },
          {
            type: 'text',
            name: 'agentId',
            message: 'Agent ID:',
          },
        ]);

        const spinner = ora('Adding agent...').start();
        await client.post(`/api/departments/${answers.deptId}/agents`, {
          agentId: answers.agentId,
        });
        spinner.stop();
        success('Agent added to department');
      } catch (err) {
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('delete <id>')
    .description('Delete a department')
    .action(async (id: string) => {
      const confirmed = await prompts({
        type: 'confirm',
        name: 'value',
        message: `Delete department "${id}"?`,
        initial: false,
      });

      if (!confirmed.value) {
        info('Cancelled');
        return;
      }

      const spinner = ora('Deleting...').start();
      try {
        await client.delete(`/api/departments/${id}`);
        spinner.stop();
        success('Department deleted');
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
