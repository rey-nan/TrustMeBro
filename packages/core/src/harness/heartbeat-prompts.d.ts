export declare function buildWakePrompt(working: string, memory: string): string;
export declare function buildStandbyPrompt(): string;
export declare function parseHeartbeatResponse(response: string): {
    status: 'ok' | 'worked';
    summary: string;
};
//# sourceMappingURL=heartbeat-prompts.d.ts.map