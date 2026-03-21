import pino from 'pino';
export class AgentRunner {
    client;
    context;
    communication = null;
    toolExecutor = null;
    runningTasks = new Map();
    logger;
    constructor(client, context, logger) {
        this.client = client;
        this.context = context;
        this.logger = logger ?? pino({ name: 'AgentRunner' });
    }
    setCommunication(communication) {
        this.communication = communication;
    }
    setToolExecutor(executor) {
        this.toolExecutor = executor;
    }
    async run(config, task) {
        const startTime = Date.now();
        const maxRetries = config.maxRetries ?? 3;
        const timeoutMs = config.timeoutMs ?? 60000;
        let attempts = 0;
        let lastError;
        this.logger.info({
            taskId: task.id,
            agentId: task.agentId,
            agentName: config.name,
            timeoutMs,
            maxRetries,
            skillIds: config.skillIds,
        }, 'Agent task started');
        while (attempts < maxRetries) {
            attempts++;
            try {
                const result = await this.executeWithTimeout(config, task, timeoutMs);
                const skillIds = config.skillIds ?? [];
                let finalContent = result.content;
                if (this.toolExecutor && skillIds.length > 0 && this.toolExecutor.hasToolCalls(finalContent)) {
                    finalContent = await this.executeToolCallsWithLLM(config, task, finalContent, skillIds);
                }
                this.context.add(task.agentId, { role: 'user', content: task.input });
                this.context.add(task.agentId, { role: 'assistant', content: finalContent });
                if (this.communication) {
                    this.communication.addTaskActivity(task.agentId, task.id, finalContent.slice(0, 200));
                    const mentions = this.extractMentions(finalContent);
                    for (const mentionedId of mentions) {
                        this.communication.send(task.agentId, mentionedId, `You were mentioned in task ${task.id}: ${finalContent.slice(0, 500)}`);
                    }
                }
                const agentResult = {
                    taskId: task.id,
                    agentId: task.agentId,
                    status: 'success',
                    output: finalContent,
                    usage: result.usage,
                    durationMs: Date.now() - startTime,
                    attempts,
                    completedAt: Date.now(),
                };
                this.logger.info({
                    taskId: task.id,
                    agentId: task.agentId,
                    durationMs: agentResult.durationMs,
                    attempts,
                    inputTokens: result.usage.inputTokens,
                    outputTokens: result.usage.outputTokens,
                }, 'Agent task completed');
                return agentResult;
            }
            catch (error) {
                lastError = error instanceof Error ? error.message : 'Unknown error';
                this.logger.warn({
                    taskId: task.id,
                    attempt: attempts,
                    maxRetries,
                    error: lastError,
                }, 'Agent task attempt failed');
                if (attempts < maxRetries) {
                    const backoffMs = Math.pow(2, attempts - 1) * 1000;
                    this.logger.info({ taskId: task.id, backoffMs }, 'Waiting before retry');
                    await this.sleep(backoffMs);
                }
            }
        }
        const failedResult = {
            taskId: task.id,
            agentId: task.agentId,
            status: 'failed',
            output: '',
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            durationMs: Date.now() - startTime,
            attempts,
            error: lastError,
            completedAt: Date.now(),
        };
        this.logger.error({
            taskId: task.id,
            agentId: task.agentId,
            attempts,
            error: lastError,
        }, 'Agent task failed after all retries');
        return failedResult;
    }
    async executeToolCallsWithLLM(config, task, initialResponse, skillIds) {
        let currentResponse = initialResponse;
        const maxRounds = 10;
        let rounds = 0;
        this.logger.info({ taskId: task.id, skillIds }, 'Starting tool execution loop');
        while (rounds < maxRounds) {
            if (!this.toolExecutor || !this.toolExecutor.hasToolCalls(currentResponse)) {
                break;
            }
            rounds++;
            this.logger.info({ taskId: task.id, round: rounds }, 'Executing tool calls');
            currentResponse = await this.toolExecutor.executeAll(currentResponse, skillIds);
            if (!this.toolExecutor.hasToolCalls(currentResponse)) {
                break;
            }
            const messages = [
                { role: 'system', content: config.systemPrompt },
                ...this.context.get(task.agentId),
                { role: 'user', content: task.input },
                { role: 'assistant', content: currentResponse },
                { role: 'user', content: 'Based on the tool results above, provide your final answer or continue with more tools if needed.' },
            ];
            try {
                const result = await this.client.call({
                    messages,
                    model: config.model,
                    temperature: config.temperature,
                    maxTokens: config.maxTokens,
                });
                currentResponse = result.content;
            }
            catch (error) {
                this.logger.warn({ error: error instanceof Error ? error.message : 'Unknown' }, 'LLM call failed in tool loop');
                break;
            }
        }
        return currentResponse;
    }
    async executeWithTimeout(config, task, timeoutMs) {
        const abortController = new AbortController();
        this.runningTasks.set(task.id, {
            abortController,
            startTime: Date.now(),
        });
        try {
            let inboxInfo = '';
            let mentionsInfo = '';
            if (this.communication) {
                const inbox = this.communication.getInbox(task.agentId);
                if (inbox.length > 0) {
                    const summarized = inbox.slice(0, 5).map((m) => `From @${m.fromAgentId}: ${m.content.slice(0, 200)}`).join('\n\n');
                    inboxInfo = `\n\nMESSAGES FOR YOU:\n${summarized}\n\nADDRESS THESE IN YOUR RESPONSE IF RELEVANT.\n`;
                }
                const mentions = this.communication.getMentions(task.agentId);
                if (mentions.length > 0) {
                    const summarizedMentions = mentions.slice(0, 5).map((m) => `@${m.fromAgentId} mentioned you`).join('\n');
                    mentionsInfo = `\n\nYOU WERE MENTIONED:\n${summarizedMentions}\n\n`;
                }
            }
            const contextMessages = this.context.get(task.agentId);
            const systemMessage = { role: 'system', content: config.systemPrompt };
            let userContent = task.input;
            if (task.context) {
                userContent += `\n\nContext: ${JSON.stringify(task.context)}`;
            }
            if (inboxInfo || mentionsInfo) {
                userContent += inboxInfo + mentionsInfo;
            }
            const messages = [
                systemMessage,
                ...contextMessages,
                { role: 'user', content: userContent },
            ];
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Task timeout exceeded'));
                }, timeoutMs);
            });
            const result = await Promise.race([
                this.client.call({
                    messages,
                    model: config.model,
                    temperature: config.temperature,
                    maxTokens: config.maxTokens,
                }),
                timeoutPromise,
            ]);
            return {
                content: result.content,
                usage: result.usage,
            };
        }
        finally {
            this.runningTasks.delete(task.id);
        }
    }
    extractMentions(content) {
        const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
        const mentions = [];
        let match;
        while ((match = mentionRegex.exec(content)) !== null) {
            if (match[1]) {
                mentions.push(match[1]);
            }
        }
        return mentions;
    }
    abort(taskId) {
        const runningTask = this.runningTasks.get(taskId);
        if (runningTask) {
            runningTask.abortController.abort();
            this.runningTasks.delete(taskId);
            this.logger.info({ taskId }, 'Agent task aborted');
            return true;
        }
        this.logger.warn({ taskId }, 'Agent task not found for abort');
        return false;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=runner.js.map