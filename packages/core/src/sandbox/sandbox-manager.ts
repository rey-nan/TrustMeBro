import pino from 'pino';
import type { SandboxLanguage, SandboxConfig, SandboxResult, SandboxStatus } from './types.js';
import { DockerSandbox } from './docker-sandbox.js';
import { LocalSandbox } from './local-sandbox.js';

export type SandboxType = 'docker' | 'local';

export interface Sandbox {
  checkAvailability(): Promise<SandboxStatus>;
  execute(config: SandboxConfig): Promise<SandboxResult>;
  executeScript(language: SandboxLanguage, code: string, timeoutMs?: number): Promise<SandboxResult>;
  cleanupOrphanedContainers(): Promise<void>;
}

export class SandboxManager {
  private sandbox: Sandbox;
  private type: SandboxType;
  private logger: pino.Logger;

  constructor(
    type: SandboxType = process.env.SANDBOX_TYPE === 'local' ? 'local' : 'docker',
    logger?: pino.Logger
  ) {
    this.logger = logger ?? pino({ name: 'SandboxManager' });
    this.type = type;
    this.sandbox = this.createSandbox(type);
  }

  private createSandbox(type: SandboxType): Sandbox {
    if (type === 'local') {
      this.logger.info('Using local sandbox (fallback)');
      return new LocalSandbox(this.logger);
    }

    const dockerSandbox = new DockerSandbox(this.logger);
    return {
      async checkAvailability(): Promise<SandboxStatus> {
        return dockerSandbox.checkAvailability();
      },
      async execute(config: SandboxConfig): Promise<SandboxResult> {
        return dockerSandbox.execute(config);
      },
      async executeScript(language: SandboxLanguage, code: string, timeoutMs?: number): Promise<SandboxResult> {
        return dockerSandbox.executeScript(language, code, timeoutMs);
      },
      async cleanupOrphanedContainers(): Promise<void> {
        return dockerSandbox.cleanupOrphanedContainers();
      },
    };
  }

  async ensureAvailable(): Promise<void> {
    const status = await this.sandbox.checkAvailability();
    if (!status.available && this.type === 'docker') {
      this.logger.warn('Docker not available, falling back to local sandbox');
      this.sandbox = new LocalSandbox(this.logger);
      this.type = 'local';
    }
  }

  getType(): SandboxType {
    return this.type;
  }

  getSandbox(): Sandbox {
    return this.sandbox;
  }

  checkAvailability(): Promise<SandboxStatus> {
    return this.sandbox.checkAvailability();
  }

  execute(config: SandboxConfig): Promise<SandboxResult> {
    return this.sandbox.execute(config);
  }

  executeScript(language: SandboxLanguage, code: string, timeoutMs?: number): Promise<SandboxResult> {
    return this.sandbox.executeScript(language, code, timeoutMs);
  }

  cleanupOrphanedContainers(): Promise<void> {
    return this.sandbox.cleanupOrphanedContainers();
  }
}
