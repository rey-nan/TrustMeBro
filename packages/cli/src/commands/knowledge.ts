import { Command } from 'commander';
import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import { ApiClient } from '../client.js';
import { error, success, info, warn, printTable, header, dim } from '../output.js';

interface KnowledgeEntry {
  id: string;
  agentId: string;
  type: string;
  title: string;
  content: string;
  tags?: string[];
  score?: number;
  createdAt: number;
}

export function createKnowledgeCommand(client: ApiClient, jsonFlag: boolean): Command {
  const cmd = new Command('knowledge');
  cmd.description('Manage knowledge base');

  cmd
    .command('list')
    .description('List knowledge entries')
    .option('--agent <id>', 'Filter by agent ID')
    .option('--type <type>', 'Filter by type (error/success/skill/document/fact/preference)')
    .action(async (options) => {
      if (!options.agent) {
        error('--agent is required');
        process.exit(1);
      }

      const spinner = ora('Fetching knowledge...').start();
      try {
        const params = new URLSearchParams();
        params.set('agentId', options.agent);
        if (options.type) params.set('type', options.type);

        const entries = await client.get<KnowledgeEntry[]>(`/api/knowledge?${params}`);
        spinner.stop();

        if (jsonFlag) {
          console.log(JSON.stringify(entries, null, 2));
          return;
        }

        if (entries.length === 0) {
          warn('No knowledge entries found');
          return;
        }

        const rows = entries.map((e) => [
          e.id.substring(0, 8) + '...',
          e.type,
          e.title.substring(0, 30) + (e.title.length > 30 ? '...' : ''),
          e.tags?.join(', ') || '-',
        ]);

        printTable(['ID', 'Type', 'Title', 'Tags'], rows);
        info(`Total: ${entries.length} entry(ies)`);
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('search <query>')
    .description('Search knowledge base semantically')
    .option('--agent <id>', 'Filter by agent ID')
    .action(async (query: string, options) => {
      const spinner = ora('Searching...').start();
      try {
        const body: { query: string; agentId?: string; limit?: number } = { query, limit: 10 };
        if (options.agent) body.agentId = options.agent;

        const results = await client.post<KnowledgeEntry[]>('/api/knowledge/search', body);
        spinner.stop();

        if (jsonFlag) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }

        if (results.length === 0) {
          warn('No results found');
          return;
        }

        results.forEach((entry, i) => {
          console.log();
          console.log(`${i + 1}. ${chalk.cyan(entry.title)} [${entry.type}]`);
          if (entry.score) {
            console.log(`   Score: ${(entry.score * 100).toFixed(1)}%`);
          }
          console.log(`   ${entry.content.substring(0, 200)}${entry.content.length > 200 ? '...' : ''}`);
          if (entry.tags && entry.tags.length > 0) {
            console.log(`   Tags: ${entry.tags.join(', ')}`);
          }
        });
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('add')
    .description('Add a knowledge entry')
    .action(async () => {
      try {
        const answers = await prompts([
          {
            type: 'text',
            name: 'agentId',
            message: 'Agent ID:',
          },
          {
            type: 'select',
            name: 'type',
            message: 'Entry type:',
            choices: [
              { title: 'Error', value: 'error' },
              { title: 'Success', value: 'success' },
              { title: 'Skill', value: 'skill' },
              { title: 'Document', value: 'document' },
              { title: 'Fact', value: 'fact' },
              { title: 'Preference', value: 'preference' },
            ],
          },
          {
            type: 'text',
            name: 'title',
            message: 'Title:',
          },
          {
            type: 'text',
            name: 'content',
            message: 'Content:',
          },
          {
            type: 'text',
            name: 'tags',
            message: 'Tags (comma-separated):',
          },
        ]);

        const spinner = ora('Adding entry...').start();
        const entry = await client.post<KnowledgeEntry>('/api/knowledge', {
          agentId: answers.agentId,
          type: answers.type,
          title: answers.title,
          content: answers.content,
          tags: answers.tags ? answers.tags.split(',').map((t: string) => t.trim()) : [],
        });
        spinner.stop();
        success(`Knowledge entry added: ${entry.id}`);
      } catch (err) {
        error((err as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('delete <id>')
    .description('Delete a knowledge entry')
    .action(async (id: string) => {
      const confirmed = await prompts({
        type: 'confirm',
        name: 'value',
        message: `Delete knowledge entry "${id}"?`,
        initial: false,
      });

      if (!confirmed.value) {
        info('Cancelled');
        return;
      }

      const spinner = ora('Deleting...').start();
      try {
        await client.delete(`/api/knowledge/${id}`);
        spinner.stop();
        success('Entry deleted');
      } catch (err) {
        spinner.stop();
        error((err as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
