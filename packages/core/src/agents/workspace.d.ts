export declare class AgentWorkspace {
    private agentId;
    private basePath;
    private workspacePath;
    private logger;
    constructor(agentId: string, basePath?: string);
    init(): Promise<void>;
    readSOUL(): string;
    updateSOUL(content: string): void;
    updateWorking(content: string): void;
    readWorking(): string;
    addMemory(entry: string): void;
    readMemory(): string;
    logDaily(entry: string): void;
    getContext(): string;
    getPath(): string;
}
//# sourceMappingURL=workspace.d.ts.map