import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import pino from 'pino';
const LANGUAGE_COMMANDS = {
    javascript: ['node', ['-e']],
    typescript: ['npx', ['ts-node', '-e']],
    python: ['python', ['-c']],
    bash: ['bash', ['-c']],
    sh: ['sh', ['-c']],
};
export class LocalSandbox {
    defaultTimeoutMs = 30000;
    logger;
    constructor(logger) {
        this.logger = logger ?? pino({ name: 'LocalSandbox' });
    }
    async checkAvailability() {
        this.logger.info('Local sandbox is always available');
        return {
            available: true,
            dockerVersion: 'N/A (local fallback)',
        };
    }
    async execute(config) {
        const startTime = Date.now();
        const sandboxId = randomUUID().slice(0, 8);
        const timeoutMs = config.timeoutMs ?? this.defaultTimeoutMs;
        const commandConfig = LANGUAGE_COMMANDS[config.language];
        if (!commandConfig) {
            return {
                stdout: '',
                stderr: '',
                exitCode: 1,
                success: false,
                durationMs: Date.now() - startTime,
                timedOut: false,
                error: `Unsupported language: ${config.language}`,
            };
        }
        const [cmd, args] = commandConfig;
        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            let killed = false;
            const fullArgs = [...args, config.code];
            const proc = spawn(cmd, fullArgs, {
                timeout: timeoutMs,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    HOME: '/tmp',
                    PATH: '/usr/bin:/bin:/usr/local/bin',
                    NODE_ENV: 'production',
                },
                cwd: '/tmp',
            });
            const timer = setTimeout(() => {
                killed = true;
                proc.kill('SIGKILL');
            }, timeoutMs);
            proc.stdout?.on('data', (data) => {
                stdout += data.toString();
                if (stdout.length > 1024 * 1024) {
                    proc.kill('SIGKILL');
                }
            });
            proc.stderr?.on('data', (data) => {
                stderr += data.toString();
                if (stderr.length > 1024 * 1024) {
                    proc.kill('SIGKILL');
                }
            });
            proc.on('close', (code) => {
                clearTimeout(timer);
                const exitCode = code ?? (killed ? 124 : 1);
                this.logger.info({
                    sandboxId,
                    exitCode,
                    timedOut: killed,
                    durationMs: Date.now() - startTime,
                }, 'Local sandbox execution completed');
                resolve({
                    stdout: stdout.slice(0, 1024 * 1024),
                    stderr: stderr.slice(0, 1024 * 1024),
                    exitCode,
                    success: exitCode === 0 && !killed,
                    durationMs: Date.now() - startTime,
                    timedOut: killed,
                });
            });
            proc.on('error', (err) => {
                clearTimeout(timer);
                resolve({
                    stdout: '',
                    stderr: err.message,
                    exitCode: 1,
                    success: false,
                    durationMs: Date.now() - startTime,
                    timedOut: false,
                    error: err.message,
                });
            });
        });
    }
    async executeScript(language, code, timeoutMs) {
        return this.execute({ language, code, timeoutMs });
    }
    async cleanupOrphanedContainers() {
        this.logger.debug('No containers to clean up in local mode');
    }
}
//# sourceMappingURL=local-sandbox.js.map