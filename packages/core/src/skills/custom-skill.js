import { exec } from 'child_process';
import { promisify } from 'util';
import pino from 'pino';
const execAsync = promisify(exec);
const logger = pino({ name: 'CustomSkill' });
function interpolateCode(code, input) {
    let result = code;
    for (const [key, value] of Object.entries(input)) {
        result = result.replace(new RegExp(`\\{\\{input\\.${key}\\}\\}`, 'g'), String(value));
    }
    return result;
}
function createToolFromDefinition(toolDef) {
    const definition = {
        name: toolDef.name,
        description: toolDef.description,
        inputSchema: {
            type: 'object',
            properties: Object.fromEntries(Object.entries(toolDef.inputSchema.properties).map(([key, val]) => [
                key,
                { type: val.type, description: val.description, required: toolDef.inputSchema.required.includes(key) },
            ])),
            required: toolDef.inputSchema.required,
        },
    };
    return {
        definition,
        execute: async (input) => {
            const timeout = toolDef.timeout || 30000;
            const code = interpolateCode(toolDef.executionCode, input);
            logger.info({ tool: toolDef.name, type: toolDef.executionType }, 'Executing custom tool');
            try {
                switch (toolDef.executionType) {
                    case 'bash': {
                        const { stdout, stderr } = await execAsync(code, { timeout });
                        return {
                            success: true,
                            result: { stdout: stdout.trim(), stderr: stderr.trim() },
                        };
                    }
                    case 'node': {
                        const { stdout, stderr } = await execAsync(`node -e "${code.replace(/"/g, '\\"')}"`, { timeout });
                        return {
                            success: true,
                            result: { stdout: stdout.trim(), stderr: stderr.trim() },
                        };
                    }
                    case 'python': {
                        const { stdout, stderr } = await execAsync(`python -c "${code.replace(/"/g, '\\"')}"`, { timeout });
                        return {
                            success: true,
                            result: { stdout: stdout.trim(), stderr: stderr.trim() },
                        };
                    }
                    case 'http': {
                        const response = await fetch(code, {
                            signal: AbortSignal.timeout(timeout),
                        });
                        const data = await response.text();
                        return {
                            success: response.ok,
                            result: { status: response.status, data },
                        };
                    }
                    default:
                        return { success: false, error: `Unknown execution type: ${toolDef.executionType}` };
                }
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : 'Execution failed';
                logger.error({ tool: toolDef.name, error: msg }, 'Custom tool execution failed');
                return { success: false, error: msg };
            }
        },
    };
}
export class CustomSkill {
    id;
    name;
    description;
    tools;
    constructor(definition) {
        this.id = definition.id;
        this.name = definition.name;
        this.description = definition.description;
        this.tools = definition.tools.map(createToolFromDefinition);
    }
}
//# sourceMappingURL=custom-skill.js.map