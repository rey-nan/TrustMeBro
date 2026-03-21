import type { Skill, Tool } from '../types.js';
export declare class GitSkill implements Skill {
    private workspaceRoot;
    id: string;
    name: string;
    description: string;
    tools: Tool[];
    constructor(workspaceRoot?: string);
    private getWorkspacePath;
    private createCloneTool;
    private createPullTool;
    private createRunTool;
    private createStatusTool;
}
//# sourceMappingURL=git-skill.d.ts.map