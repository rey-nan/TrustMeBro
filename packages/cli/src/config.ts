import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CliConfig {
  apiUrl: string;
  apiKey?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.trustmebro');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): CliConfig {
  const apiUrl = process.env.TMB_API_URL || 'http://localhost:3000';
  const apiKey = process.env.TMB_API_KEY;

  const fileConfig = loadConfigFromFile();
  
  return {
    apiUrl: fileConfig?.apiUrl || apiUrl,
    apiKey: apiKey || fileConfig?.apiKey,
  };
}

export function loadConfigFromFile(): Partial<CliConfig> | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // Ignore errors
  }
  return null;
}

export function saveConfig(config: Partial<CliConfig>): void {
  ensureConfigDir();
  const current = loadConfigFromFile() || {};
  const updated = { ...current, ...config };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}
