#!/usr/bin/env node
/**
 * TrustMeBro Universal Starter
 * Works on Windows, Linux and Mac without global install
 * Usage: node start.js [command]
 * 
 * Examples:
 *   node start.js          → starts full system (API + Dashboard)
 *   node start.js setup    → runs setup wizard
 *   node start.js meta     → opens Meta-Agent chat
 *   node start.js status   → shows system status
 *   node start.js help     → shows all commands
 */

const { execSync, spawn } = require('child_process');
const { existsSync } = require('fs');
const { resolve } = require('path');
const os = require('os');

const rootDir = __dirname;
const cliDist = resolve(rootDir, 'packages/cli/dist/index.js');
const coreDist = resolve(rootDir, 'packages/core/dist/index.js');

const command = process.argv[2] || 'start';
const args = process.argv.slice(3);

// Colors
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function needsBuild() {
  return !existsSync(cliDist) || !existsSync(coreDist);
}

function build() {
  console.log(yellow('Building TrustMeBro...'));
  try {
    execSync('npm install', { cwd: rootDir, stdio: 'inherit' });
    execSync('npm run build:core', { cwd: rootDir, stdio: 'inherit' });
    execSync('npm run build:cli', { cwd: rootDir, stdio: 'inherit' });
    console.log(green('✓ Build complete!\n'));
  } catch (err) {
    console.error('Build failed. Please check the error above.');
    process.exit(1);
  }
}

function runCli(args) {
  if (needsBuild()) build();
  const result = spawn('node', [cliDist, ...args], {
    stdio: 'inherit',
    cwd: rootDir
  });
  result.on('exit', (code) => process.exit(code || 0));
}

function showHelp() {
  console.log(bold('\nTrustMeBro — Not Skynet. Probably.\n'));
  console.log('Usage: node start.js [command]\n');
  console.log('Commands:');
  console.log('  ' + green('(no command)') + '    Start API + Dashboard');
  console.log('  ' + green('setup') + '           Run setup wizard');
  console.log('  ' + green('meta') + '            Open Meta-Agent chat');
  console.log('  ' + green('status') + '          Show system status');
  console.log('  ' + green('agent list') + '      List all agents');
  console.log('  ' + green('agent run') + ' <id>  Run a task on an agent');
  console.log('  ' + green('help') + '            Show this help\n');
  console.log(dim('Tip: After running `npm link packages/cli`, use `tmb` instead of `node start.js`\n'));
}

// Command routing
switch (command) {
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;

  case 'setup':
    runCli(['setup', ...args]);
    break;

  case 'meta':
    runCli(['meta', ...args]);
    break;

  case 'status':
    runCli(['status', ...args]);
    break;

  case 'agent':
  case 'task':
  case 'workflow':
  case 'knowledge':
  case 'heartbeat':
  case 'dept':
    runCli([command, ...args]);
    break;

  case 'start':
  default:
    // Start API + Dashboard
    if (needsBuild()) build();
    
    // Check if configured
    const envPath = resolve(rootDir, '.env');
    const fs = require('fs');
    let isConfigured = false;
    
    if (existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      isConfigured = envContent.includes('LLM_API_KEY=') && 
                     !envContent.includes('LLM_API_KEY=\n') && 
                     !envContent.includes('LLM_API_KEY=your_api_key_here');
    }
    
    if (!isConfigured) {
      console.log(yellow('\n  Looks like TrustMeBro is not configured yet.\n'));
      console.log('  Run: ' + green('node start.js setup') + '\n');
      process.exit(0);
    }
    
    console.log(bold('\nStarting TrustMeBro...'));
    console.log(dim('  API:       http://localhost:3000'));
    console.log(dim('  Dashboard: http://localhost:5173'));
    console.log(dim('  Press Ctrl+C to stop\n'));
    
    const isWindows = os.platform() === 'win32';
    const npmCmd = isWindows ? 'npm.cmd' : 'npm';
    
    const dev = spawn(npmCmd, ['run', 'dev'], {
      stdio: 'inherit',
      cwd: rootDir,
      shell: isWindows
    });
    dev.on('exit', (code) => process.exit(code || 0));
    break;
}
