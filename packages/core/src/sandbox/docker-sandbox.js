import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import pino from 'pino';
const execAsync = promisify(exec);
const LANGUAGE_CONFIG = {
    javascript: { image: 'node:20-alpine', filename: 'index.js', command: 'node index.js' },
    typescript: { image: 'node:20-alpine', filename: 'index.ts', command: 'npx ts-node index.ts' },
    python: { image: 'python:3.11-alpine', filename: 'main.py', command: 'python main.py' },
    bash: { image: 'alpine:latest', filename: 'run.sh', command: 'sh run.sh' },
    sh: { image: 'alpine:latest', filename: 'run.sh', command: 'sh run.sh' },
};
const MAX_OUTPUT_SIZE = 1024 * 1024;
export class DockerSandbox {
    defaultTimeoutMs = 30000;
    defaultMemoryMb = 128;
    defaultCpus = 0.5;
    logger;
    constructor(logger) {
        this.logger = logger ?? pino({ name: 'DockerSandbox' });
    }
    async checkAvailability() {
        try {
            const { stdout } = await execAsync('docker --version', { timeout: 5000 });
            const version = stdout.trim();
            this.logger.info({ version }, 'Docker is available');
            return {
                available: true,
                dockerVersion: version,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn({ error: message }, 'Docker is not available');
            return {
                available: false,
                error: message,
            };
        }
    }
    async execute(config) {
        const startTime = Date.now();
        const sandboxId = randomUUID().slice(0, 8);
        const tempDir = `/tmp/trustmebro-sandbox-${sandboxId}`;
        const timeoutMs = config.timeoutMs ?? this.defaultTimeoutMs;
        const memoryMb = config.memoryMb ?? this.defaultMemoryMb;
        const cpus = config.cpus ?? this.defaultCpus;
        const networkEnabled = config.networkEnabled ?? false;
        const langConfig = LANGUAGE_CONFIG[config.language];
        if (!langConfig) {
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
        try {
            mkdirSync(tempDir, { recursive: true });
            writeFileSync(join(tempDir, langConfig.filename), config.code, 'utf-8');
            if (config.files && config.files.length > 0) {
                for (const file of config.files) {
                    const filePath = join(tempDir, file.path);
                    const fileDir = dirname(filePath);
                    if (!existsSync(fileDir)) {
                        mkdirSync(fileDir, { recursive: true });
                    }
                    writeFileSync(filePath, file.content, 'utf-8');
                }
            }
            let dockerCommand = `docker run --rm --name trustmebro-${sandboxId} --memory=${memoryMb}m --cpus=${cpus}`;
            if (!networkEnabled) {
                dockerCommand += ' --network none';
            }
            dockerCommand += ' --read-only --tmpfs /tmp:size=50m';
            dockerCommand += ` -v ${tempDir}:/workspace:ro`;
            dockerCommand += ' -w /workspace';
            dockerCommand += ` ${langConfig.image} ${langConfig.command}`;
            this.logger.info({
                sandboxId,
                language: config.language,
                timeoutMs,
                memoryMb,
            }, 'Executing sandbox');
            let stdout = '';
            let stderr = '';
            let exitCode = 0;
            let timedOut = false;
            try {
                const result = await Promise.race([
                    execAsync(dockerCommand, { timeout: timeoutMs, maxBuffer: MAX_OUTPUT_SIZE }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
                ]);
                stdout = (result.stdout || '').slice(0, MAX_OUTPUT_SIZE);
                stderr = (result.stderr || '').slice(0, MAX_OUTPUT_SIZE);
            }
            catch (error) {
                if (error instanceof Error && error.message === 'Timeout') {
                    timedOut = true;
                    try {
                        await execAsync(`docker kill trustmebro-${sandboxId}`, { timeout: 5000 });
                    }
                    catch {
                    }
                    stdout = '(output truncated due to timeout)';
                    stderr = '';
                    exitCode = 124;
                }
                else {
                    const execError = error;
                    if (execError.message) {
                        stderr = execError.message.slice(0, MAX_OUTPUT_SIZE);
                    }
                    exitCode = typeof execError.code === 'number' ? execError.code : 1;
                }
            }
            this.logger.info({
                sandboxId,
                exitCode,
                timedOut,
                durationMs: Date.now() - startTime,
            }, 'Sandbox execution completed');
            return {
                stdout,
                stderr,
                exitCode,
                success: exitCode === 0 && !timedOut,
                durationMs: Date.now() - startTime,
                timedOut,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error({ sandboxId, error: errorMessage }, 'Sandbox execution failed');
            return {
                stdout: '',
                stderr: '',
                exitCode: 1,
                success: false,
                durationMs: Date.now() - startTime,
                timedOut: false,
                error: errorMessage,
            };
        }
        finally {
            try {
                rmSync(tempDir, { recursive: true, force: true });
            }
            catch {
            }
        }
    }
    async executeScript(language, code, timeoutMs) {
        return this.execute({
            language,
            code,
            timeoutMs,
        });
    }
    async cleanupOrphanedContainers() {
        try {
            await execAsync('docker rm -f $(docker ps -aq --filter name=trustmebro-)', {
                timeout: 10000,
            });
            this.logger.info('Cleaned up orphaned sandbox containers');
        }
        catch {
            this.logger.debug('No orphaned containers to clean up');
        }
    }
}
//# sourceMappingURL=docker-sandbox.js.map