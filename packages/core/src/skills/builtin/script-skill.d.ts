import type { Skill, Tool } from '../types.js';
export declare class ScriptSkill implements Skill {
    private workspaceRoot;
    id: string;
    name: string;
    description: string;
    tools: Tool[];
    constructor(workspaceRoot?: string);
    private getWorkspacePath;
    private createRunScriptTool;
    private createRunNodeTool;
    private createRunPythonTool;
    private createListScriptsTool;
    private executeScript;
}
//# sourceMappingURL=script-skill.d.ts.map