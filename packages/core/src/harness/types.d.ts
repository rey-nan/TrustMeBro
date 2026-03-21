export interface HarnessConfig {
    maxRetries: number;
    maxLoops: number;
    maxExecutionTimeMs: number;
    verificationThreshold: number;
    loopDetectionWindow: number;
}
export interface ExecutionTrace {
    id: string;
    agentId: string;
    taskId: string;
    timestamp: number;
    type: 'start' | 'retry' | 'success' | 'failed' | 'timeout' | 'loop_detected' | 'verified' | 'rejected' | 'planning' | 'execution' | 'pre-completion:passed' | 'pre-completion:failed';
    message: string;
    metadata?: Record<string, unknown>;
}
export interface VerificationResult {
    score: number;
    passed: boolean;
    reasons: string[];
    suggestion?: string;
}
export interface LoopRecord {
    agentId: string;
    taskSignature: string;
    count: number;
    firstSeen: number;
    lastSeen: number;
}
//# sourceMappingURL=types.d.ts.map