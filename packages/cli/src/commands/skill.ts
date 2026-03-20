import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { ApiClient } from '../client.js';
import { error, success, info, warn, printTable } from '../output.js';

interface Skill {
  id: string;
  name: string;
  description?: string;
  version?: string;
  enabled?: boolean;
}

export function createSkillCommand(client: ApiClient, jsonFlag: boolean): Command {
  const cmd = new Command('skill');
  cmd.description('Manage skills');

  cmd
    .command('list')
    .description('List all available skills')
    .action(async () => {
      const spinner = ora('Fetching skills...').start();
      try {
        const skills = await client.get<Skill[]>('/api/skills');
        spinner.stop();

        if (jsonFlag) {
          console.log(JSON.stringify(skills, null, 2));
          return;
        }

        if (skills.length === 0) {
          warn('No skills found');
          return;
        }

        const rows = skills.map((s) => [
          s.id,
          s.name,
          s.description?.substring(0, 40) + (s.description && s.description.length > 40 ? '...' : '') || '-',
          s.version || '-',
          s.enabled !== false ? '✓' : '✗',
        ]);

        printTable(['ID', 'Name', 'Description', 'Version', 'Enabled'], rows);
        info(`Total: ${skills.length} skill(s)`);
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('get <id>')
    .description('Get skill details')
    .action(async (id: string) => {
      const spinner = ora('Fetching skill...').start();
      try {
        const skill = await client.get<Skill>(`/api/skills/${id}`);
        spinner.stop();

        if (jsonFlag) {
          console.log(JSON.stringify(skill, null, 2));
          return;
        }

        console.log();
        console.log(`  ${chalk.cyan('ID')}:          ${skill.id}`);
        console.log(`  ${chalk.cyan('Name')}:        ${skill.name}`);
        if (skill.description) {
          console.log(`  ${chalk.cyan('Description')}: ${skill.description}`);
        }
        if (skill.version) {
          console.log(`  ${chalk.cyan('Version')}:     ${skill.version}`);
        }
        console.log(`  ${chalk.cyan('Enabled')}:     ${skill.enabled !== false ? 'Yes' : 'No'}`);
        console.log();
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('enable <id>')
    .description('Enable a skill')
    .action(async (id: string) => {
      const spinner = ora('Enabling skill...').start();
      try {
        await client.post(`/api/skills/${id}/enable`);
        spinner.stop();
        success(`Skill "${id}" enabled`);
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('disable <id>')
    .description('Disable a skill')
    .action(async (id: string) => {
      const spinner = ora('Disabling skill...').start();
      try {
        await client.post(`/api/skills/${id}/disable`);
        spinner.stop();
        success(`Skill "${id}" disabled`);
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
