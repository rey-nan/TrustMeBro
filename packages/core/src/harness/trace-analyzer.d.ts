import pino from 'pino';
import type { ExecutionTrace } from './types.js';
export declare class TraceAnalyzer {
    private db;
    private memoryTraces;
    private logger;
    private maxMemoryTraces;
    constructor(dbPath?: string, logger?: pino.Logger);
    private initDb;
    record(trace: ExecutionTrace): void;
    analyze(agentId: string): {
        errors: number;
        loops: number;
        avgDuration: number;
        successRate: number;
    };
    getReport(agentId: string): string;
    getTraces(agentId: string, limit?: number): ExecutionTrace[];
    private getTracesFromDb;
    close(): void;
}
//# sourceMappingURL=trace-analyzer.d.ts.map