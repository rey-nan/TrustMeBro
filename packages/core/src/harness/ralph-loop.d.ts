import pino from 'pino';
export interface RalphLoopOptions<T> {
    maxRetries?: number;
    retryOn?: string[];
    onRetry?: (attempt: number, error: Error) => void;
}
export declare class RalphLoop {
    private logger;
    constructor(logger?: pino.Logger);
    execute<T>(fn: () => Promise<T>, options?: RalphLoopOptions<T>): Promise<T>;
    private sleep;
}
//# sourceMappingURL=ralph-loop.d.ts.map