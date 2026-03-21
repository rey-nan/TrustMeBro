import pino from 'pino';
import type { SandboxLanguage, SandboxConfig, SandboxResult, SandboxStatus } from './types.js';
export type SandboxType = 'docker' | 'local';
export interface Sandbox {
    checkAvailability(): Promise<SandboxStatus>;
    execute(config: SandboxConfig): Promise<SandboxResult>;
    executeScript(language: SandboxLanguage, code: string, timeoutMs?: number): Promise<SandboxResult>;
    cleanupOrphanedContainers(): Promise<void>;
}
export declare class SandboxManager {
    private sandbox;
    private type;
    private logger;
    constructor(type?: SandboxType, logger?: pino.Logger);
    private createSandbox;
    ensureAvailable(): Promise<void>;
    getType(): SandboxType;
    getSandbox(): Sandbox;
    checkAvailability(): Promise<SandboxStatus>;
    execute(config: SandboxConfig): Promise<SandboxResult>;
    executeScript(language: SandboxLanguage, code: string, timeoutMs?: number): Promise<SandboxResult>;
    cleanupOrphanedContainers(): Promise<void>;
}
//# sourceMappingURL=sandbox-manager.d.ts.map