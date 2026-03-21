import type { WorkflowDefinition, WorkflowRun } from './types.js';
export declare class WorkflowRegistry {
    private filePath;
    constructor(filePath?: string);
    private loadAll;
    private saveAll;
    create(def: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>): WorkflowDefinition;
    private generateId;
    get(id: string): WorkflowDefinition | undefined;
    list(): WorkflowDefinition[];
    update(id: string, partial: Partial<Omit<WorkflowDefinition, 'id' | 'createdAt'>>): WorkflowDefinition | undefined;
    remove(id: string): boolean;
}
export declare class WorkflowRunStore {
    private db;
    constructor(db: import('better-sqlite3').Database);
    private initTable;
    save(run: WorkflowRun): void;
    get(id: string): WorkflowRun | undefined;
    listByWorkflow(workflowId: string, limit?: number): WorkflowRun[];
    listRecent(limit?: number): WorkflowRun[];
}
//# sourceMappingURL=workflow-registry.d.ts.map