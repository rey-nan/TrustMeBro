import pino from 'pino';
import { AgentConfig } from './types.js';
export declare class AgentRegistry {
    private agents;
    private logger;
    private filePath;
    constructor(filePath?: string, logger?: pino.Logger);
    register(config: AgentConfig): void;
    get(agentId: string): AgentConfig | undefined;
    list(): AgentConfig[];
    remove(agentId: string): boolean;
    private load;
    private save;
}
//# sourceMappingURL=registry.d.ts.map