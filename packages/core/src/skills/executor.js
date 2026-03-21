import pino from 'pino';
export class ToolExecutor {
    registry;
    logger;
    timeoutMs = 30000;
    maxToolRounds = 10;
    constructor(registry, logger) {
        this.registry = registry;
        this.logger = logger ?? pino({ name: 'ToolExecutor' });
    }
    parseToolCalls(text) {
        const calls = [];
        const regex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            try {
                const content = match[1]?.trim();
                if (!content)
                    continue;
                const parsed = JSON.parse(content);
                if (parsed.tool && parsed.input) {
                    calls.push({
                        tool: parsed.tool,
                        input: parsed.input,
                    });
                }
            }
            catch (error) {
                const matchContent = match[1];
                this.logger.warn({ content: matchContent?.slice(0, 100) }, 'Failed to parse tool call');
            }
        }
        return calls;
    }
    async execute(toolName, input, skillIds) {
        const tools = this.registry.getToolsForAgent(skillIds);
        const tool = tools.find((t) => t.definition.name === toolName);
        if (!tool) {
            this.logger.warn({ toolName }, 'Tool not found');
            return {
                success: false,
                error: `Tool '${toolName}' not found`,
            };
        }
        const startTime = Date.now();
        try {
            this.logger.info({ tool: toolName, input }, 'Executing tool');
            const result = await this.executeWithTimeout(tool, input);
            this.logger.info({
                tool: toolName,
                durationMs: Date.now() - startTime,
                success: result.success,
            }, 'Tool execution completed');
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error({ tool: toolName, error: message }, 'Tool execution failed');
            return {
                success: false,
                error: message,
            };
        }
    }
    async executeWithTimeout(tool, input) {
        return Promise.race([
            tool.execute(input),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Tool execution timeout')), this.timeoutMs)),
        ]);
    }
    async executeAll(text, skillIds) {
        let currentText = text;
        let rounds = 0;
        while (rounds < this.maxToolRounds) {
            const calls = this.parseToolCalls(currentText);
            if (calls.length === 0) {
                break;
            }
            this.logger.info({ round: rounds + 1, callCount: calls.length }, 'Processing tool calls');
            let resultsText = '';
            for (const { tool, input } of calls) {
                const result = await this.execute(tool, input, skillIds);
                resultsText += `<tool_result>\n${JSON.stringify(result, null, 2)}\n</tool_result>\n\n`;
            }
            currentText = currentText.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim();
            currentText += '\n\n' + resultsText.trim();
            rounds++;
        }
        if (rounds >= this.maxToolRounds) {
            this.logger.warn({ rounds }, 'Max tool rounds reached');
            currentText += '\n\n[Max tool execution rounds reached. Please provide your final answer.]';
        }
        return currentText;
    }
    hasToolCalls(text) {
        return this.parseToolCalls(text).length > 0;
    }
}
//# sourceMappingURL=executor.js.map