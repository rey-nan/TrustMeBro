import pino from 'pino';
import type { SandboxLanguage, SandboxConfig, SandboxResult, SandboxStatus } from './types.js';
export declare class LocalSandbox {
    private defaultTimeoutMs;
    private logger;
    constructor(logger?: pino.Logger);
    checkAvailability(): Promise<SandboxStatus>;
    execute(config: SandboxConfig): Promise<SandboxResult>;
    executeScript(language: SandboxLanguage, code: string, timeoutMs?: number): Promise<SandboxResult>;
    cleanupOrphanedContainers(): Promise<void>;
}
//# sourceMappingURL=local-sandbox.d.ts.map