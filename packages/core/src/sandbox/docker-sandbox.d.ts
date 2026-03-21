import pino from 'pino';
import type { SandboxLanguage, SandboxConfig, SandboxResult, SandboxStatus } from './types.js';
export declare class DockerSandbox {
    private defaultTimeoutMs;
    private defaultMemoryMb;
    private defaultCpus;
    private logger;
    constructor(logger?: pino.Logger);
    checkAvailability(): Promise<SandboxStatus>;
    execute(config: SandboxConfig): Promise<SandboxResult>;
    executeScript(language: SandboxLanguage, code: string, timeoutMs?: number): Promise<SandboxResult>;
    cleanupOrphanedContainers(): Promise<void>;
}
//# sourceMappingURL=docker-sandbox.d.ts.map