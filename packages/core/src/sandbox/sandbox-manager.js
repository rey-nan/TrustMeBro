import pino from 'pino';
import { DockerSandbox } from './docker-sandbox.js';
import { LocalSandbox } from './local-sandbox.js';
export class SandboxManager {
    sandbox;
    type;
    logger;
    constructor(type = process.env.SANDBOX_TYPE === 'local' ? 'local' : 'docker', logger) {
        this.logger = logger ?? pino({ name: 'SandboxManager' });
        this.type = type;
        this.sandbox = this.createSandbox(type);
    }
    createSandbox(type) {
        if (type === 'local') {
            this.logger.info('Using local sandbox (fallback)');
            return new LocalSandbox(this.logger);
        }
        const dockerSandbox = new DockerSandbox(this.logger);
        return {
            async checkAvailability() {
                return dockerSandbox.checkAvailability();
            },
            async execute(config) {
                return dockerSandbox.execute(config);
            },
            async executeScript(language, code, timeoutMs) {
                return dockerSandbox.executeScript(language, code, timeoutMs);
            },
            async cleanupOrphanedContainers() {
                return dockerSandbox.cleanupOrphanedContainers();
            },
        };
    }
    async ensureAvailable() {
        const status = await this.sandbox.checkAvailability();
        if (!status.available && this.type === 'docker') {
            this.logger.warn('Docker not available, falling back to local sandbox');
            this.sandbox = new LocalSandbox(this.logger);
            this.type = 'local';
        }
    }
    getType() {
        return this.type;
    }
    getSandbox() {
        return this.sandbox;
    }
    checkAvailability() {
        return this.sandbox.checkAvailability();
    }
    execute(config) {
        return this.sandbox.execute(config);
    }
    executeScript(language, code, timeoutMs) {
        return this.sandbox.executeScript(language, code, timeoutMs);
    }
    cleanupOrphanedContainers() {
        return this.sandbox.cleanupOrphanedContainers();
    }
}
//# sourceMappingURL=sandbox-manager.js.map