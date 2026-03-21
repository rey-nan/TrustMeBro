import pino from 'pino';
import { LLMClient } from '../llm/index.js';
import type { AgentTask, AgentResult } from '../agents/index.js';
import type { VerificationResult } from './types.js';
export declare class SelfVerification {
    private client;
    private verificationThreshold;
    private logger;
    constructor(client: LLMClient, verificationThreshold?: number, logger?: pino.Logger);
    verify(task: AgentTask, result: AgentResult): Promise<VerificationResult>;
    verifyPlan(plan: string): Promise<VerificationResult>;
    private parseResponse;
}
//# sourceMappingURL=verification.d.ts.map