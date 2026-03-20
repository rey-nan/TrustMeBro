#!/usr/bin/env node

/**
 * TrustMeBro Setup Script
 * 
 * Run this after cloning:
 *   node setup.js
 * 
 * This script:
 * 1. Installs dependencies
 * 2. Builds the CLI
 * 3. Runs the interactive setup wizard
 */

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

console.log('');
console.log('TrustMeBro Setup');
console.log('Not Skynet. Probably.');
console.log('');
console.log('Building CLI...');
console.log('');

const rootDir = __dirname;

function run(cmd, options = {}) {
  try {
    execSync(cmd, {
      cwd: rootDir,
      stdio: 'inherit',
      ...options,
    });
    return true;
  } catch (err) {
    console.error(`Failed: ${cmd}`);
    console.error(err.message);
    return false;
  }
}

async function main() {
  // Check if .env exists, create from example if not
  const envPath = path.join(rootDir, '.env');
  const envExamplePath = path.join(rootDir, '.env.example');
  
  if (!existsSync(envPath) && existsSync(envExamplePath)) {
    console.log('Creating .env from .env.example...');
    const fs = require('fs');
    fs.copyFileSync(envExamplePath, envPath);
  }

  // Install dependencies
  console.log('Installing dependencies...');
  if (!run('npm install')) {
    process.exit(1);
  }

  // Build core
  console.log('');
  console.log('Building core package...');
  if (!run('npm run build:core')) {
    process.exit(1);
  }

  // Build CLI
  console.log('');
  console.log('Building CLI...');
  if (!run('npm run build:cli')) {
    process.exit(1);
  }

  // Run setup wizard
  console.log('');
  console.log('Starting setup wizard...');
  console.log('');

  const cliPath = path.join(rootDir, 'packages', 'cli', 'dist', 'index.js');
  
  if (!existsSync(cliPath)) {
    console.error('CLI build failed. Try running:');
    console.error('  npm run build:cli');
    process.exit(1);
  }

  try {
    execSync(`node "${cliPath}" setup`, {
      cwd: rootDir,
      stdio: 'inherit',
    });
  } catch (err) {
    // Setup wizard exited, which is normal
    if (err.status !== 0) {
      console.error('Setup failed:', err.message);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
