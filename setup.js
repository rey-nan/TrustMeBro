#!/usr/bin/env node

/**
 * TrustMeBro Setup Script
 *
 * Run this after cloning:
 *   node setup.js
 *
 * Works on Windows, Linux, and Mac.
 */

const { execSync, spawn } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const rootDir = __dirname;

// Colors
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

console.log(bold('\nTrustMeBro Setup'));
console.log(cyan('Not Skynet. Probably.\n'));

// Check/create .env
const envPath = path.join(rootDir, '.env');
const envExamplePath = path.join(rootDir, '.env.example');

if (!existsSync(envPath) && existsSync(envExamplePath)) {
  console.log('Creating .env from .env.example...');
  const fs = require('fs');
  fs.copyFileSync(envExamplePath, envPath);
}

// Build
try {
  console.log('Installing dependencies...');
  execSync(`${npmCmd} install`, { cwd: rootDir, stdio: 'inherit' });

  console.log('\nBuilding core...');
  execSync(`${npmCmd} run build:core`, { cwd: rootDir, stdio: 'inherit' });

  console.log('\nBuilding CLI...');
  execSync(`${npmCmd} run build:cli`, { cwd: rootDir, stdio: 'inherit' });

  console.log(green('\n✓ Build complete!\n'));
} catch (err) {
  console.error('\nBuild failed:', err.message);
  process.exit(1);
}

// Run setup directly via compiled CLI (no tmb needed)
const cliPath = path.join(rootDir, 'packages', 'cli', 'dist', 'index.js');

if (!existsSync(cliPath)) {
  console.error('CLI build failed. Please run: npm run build:cli');
  process.exit(1);
}

console.log('Starting setup wizard...\n');

const setupProcess = spawn('node', [cliPath, 'setup'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env },
});

setupProcess.on('exit', (code) => {
  process.exit(code || 0);
});

setupProcess.on('error', (err) => {
  console.error('Failed to start setup:', err.message);
  process.exit(1);
});
