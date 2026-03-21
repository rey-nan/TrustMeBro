export type SandboxLanguage = 'javascript' | 'typescript' | 'python' | 'bash' | 'sh';
export interface SandboxConfig {
    language: SandboxLanguage;
    code: string;
    files?: Array<{
        path: string;
        content: string;
    }>;
    env?: Record<string, string>;
    timeoutMs?: number;
    memoryMb?: number;
    cpus?: number;
    networkEnabled?: boolean;
}
export interface SandboxResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    success: boolean;
    durationMs: number;
    timedOut: boolean;
    error?: string;
}
export interface SandboxStatus {
    available: boolean;
    dockerVersion?: string;
    error?: string;
}
//# sourceMappingURL=types.d.ts.map