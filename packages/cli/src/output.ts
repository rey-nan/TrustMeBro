import chalk from 'chalk';
import { table } from 'table';

chalk.level = 3;

export function success(msg: string): void {
  console.log(chalk.green('✓ ') + msg);
}

export function error(msg: string): void {
  console.error(chalk.red('✗ ') + msg);
}

export function info(msg: string): void {
  console.log(chalk.blue('ℹ ') + msg);
}

export function warn(msg: string): void {
  console.warn(chalk.yellow('⚠ ') + msg);
}

export function header(msg: string): void {
  console.log(chalk.bold(msg));
}

export function dim(msg: string): void {
  console.log(chalk.dim(msg));
}

export function printTable(headers: string[], rows: string[][]): void {
  const data = [headers, ...rows];
  const rendered = table(data, {
    border: {
      topBody: '',
      topJoin: '',
      topLeft: '',
      topRight: '',
      bottomBody: '',
      bottomJoin: '',
      bottomLeft: '',
      bottomRight: '',
      bodyLeft: '',
      bodyRight: '',
      bodyJoin: '',
      joinLeft: '',
      joinRight: '',
      joinJoin: '',
    },
    columnDefault: {
      paddingLeft: 2,
      paddingRight: 2,
    },
    drawHorizontalLine: () => false,
  });
  console.log(rendered);
}

export function printJson(data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  const colored = json
    .replace(/"([^"]+)":/g, chalk.cyan('"$1":'))
    .replace(/: "([^"]*)"/g, (match, value) => `: ${chalk.green(`"${value}"`)}`)
    .replace(/: (\d+)/g, (_, num) => `: ${chalk.yellow(num)}`)
    .replace(/: (true|false)/g, (_, bool) => `: ${chalk.blue(bool)}`)
    .replace(/: (null)/g, (_, nil) => `: ${chalk.gray(nil)}`);
  console.log(colored);
}

interface AgentInfo {
  id: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  level?: string;
  departmentId?: string;
  heartbeatCron?: string;
}

export function printAgentCard(agent: AgentInfo): void {
  console.log();
  header(`Agent: ${agent.name}`);
  dim('─'.repeat(50));
  console.log(`  ${chalk.cyan('ID')}:          ${agent.id}`);
  if (agent.description) {
    console.log(`  ${chalk.cyan('Description')}: ${agent.description}`);
  }
  if (agent.model) {
    console.log(`  ${chalk.cyan('Model')}:       ${agent.model}`);
  }
  if (agent.level) {
    console.log(`  ${chalk.cyan('Level')}:       ${agent.level}`);
  }
  if (agent.departmentId) {
    console.log(`  ${chalk.cyan('Department')}:  ${agent.departmentId}`);
  }
  if (agent.heartbeatCron) {
    console.log(`  ${chalk.cyan('Heartbeat')}:   ${agent.heartbeatCron}`);
  }
  if (agent.systemPrompt) {
    console.log();
    info('System Prompt:');
    console.log(chalk.gray('  ' + agent.systemPrompt.substring(0, 200) + (agent.systemPrompt.length > 200 ? '...' : '')));
  }
  console.log();
}

interface TaskResult {
  id: string;
  status: string;
  output?: string;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
}

export function printTaskResult(result: TaskResult): void {
  console.log();
  header(`Task Result: ${result.id}`);
  dim('─'.repeat(50));
  console.log(`  ${chalk.cyan('Status')}:     ${result.status}`);
  
  if (result.durationMs) {
    console.log(`  ${chalk.cyan('Duration')}:   ${result.durationMs}ms`);
  }
  if (result.inputTokens || result.outputTokens) {
    console.log(`  ${chalk.cyan('Tokens')}:     In: ${result.inputTokens || 0}, Out: ${result.outputTokens || 0}`);
  }
  
  if (result.output) {
    console.log();
    info('Output:');
    console.log(chalk.gray('  ' + result.output.substring(0, 500) + (result.output.length > 500 ? '\n  ...' : '')));
  }
  
  if (result.error) {
    console.log();
    error('Error:');
    console.log(chalk.red('  ' + result.error));
  }
  console.log();
}
