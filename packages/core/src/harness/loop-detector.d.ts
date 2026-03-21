import pino from 'pino';
import type { LoopRecord } from './types.js';
export declare class LoopDetector {
    private records;
    private maxLoops;
    private logger;
    constructor(maxLoops?: number, logger?: pino.Logger);
    record(agentId: string, taskInput: string): LoopRecord;
    isLooping(agentId: string, taskInput: string): boolean;
    clear(agentId?: string): void;
    getStats(): LoopRecord[];
    private createSignature;
}
//# sourceMappingURL=loop-detector.d.ts.map