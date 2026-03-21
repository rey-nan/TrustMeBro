import cron from 'node-cron';
import pino from 'pino';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { buildWakePrompt, buildStandbyPrompt, parseHeartbeatResponse } from './heartbeat-prompts.js';
const HEARTBEATS_FILE = 'data/heartbeats.json';
const MAX_CONSECUTIVE_ERRORS = 3;
export class HeartbeatSystem {
    agentRegistry;
    harness;
    createWorkspace;
    communication = null;
    broadcast;
    jobs = new Map();
    status = new Map();
    logger;
    constructor(agentRegistry, harness, createWorkspace, broadcast, logger) {
        this.agentRegistry = agentRegistry;
        this.harness = harness;
        this.createWorkspace = createWorkspace;
        this.broadcast = broadcast ?? (() => { });
        this.logger = logger ?? pino({ name: 'HeartbeatSystem' });
    }
    setCommunication(communication) {
        this.communication = communication;
    }
    register(agentId, cronExpression) {
        if (!cron.validate(cronExpression)) {
            this.logger.error({ agentId, cronExpression }, 'Invalid cron expression');
            return false;
        }
        const existing = this.status.get(agentId);
        if (existing?.isActive) {
            this.logger.warn({ agentId }, 'Agent already has active heartbeat');
            return false;
        }
        const agent = this.agentRegistry.get(agentId);
        if (!agent) {
            this.logger.error({ agentId }, 'Agent not found');
            return false;
        }
        this.status.set(agentId, {
            agentId,
            cronExpression,
            isActive: true,
            consecutiveErrors: existing?.consecutiveErrors ?? 0,
        });
        const task = cron.schedule(cronExpression, () => this.wakeAgent(agentId));
        this.jobs.set(agentId, task);
        this.save();
        this.logger.info({ agentId, cronExpression }, 'Heartbeat registered');
        this.broadcast({
            type: 'heartbeat:registered',
            payload: { agentId, cronExpression },
            timestamp: Date.now(),
        });
        return true;
    }
    unregister(agentId) {
        const task = this.jobs.get(agentId);
        if (task) {
            task.stop();
            this.jobs.delete(agentId);
        }
        this.status.delete(agentId);
        this.save();
        this.logger.info({ agentId }, 'Heartbeat unregistered');
        return true;
    }
    start() {
        this.load();
        for (const [agentId, record] of Object.entries(this.loadRecords())) {
            const agent = this.agentRegistry.get(agentId);
            if (!agent)
                continue;
            if (!cron.validate(record.cronExpression)) {
                this.logger.warn({ agentId, cronExpression: record.cronExpression }, 'Invalid cron, skipping');
                continue;
            }
            this.status.set(agentId, {
                agentId,
                cronExpression: record.cronExpression,
                isActive: true,
                consecutiveErrors: record.consecutiveErrors,
            });
            const task = cron.schedule(record.cronExpression, () => this.wakeAgent(agentId));
            this.jobs.set(agentId, task);
            this.logger.info({ agentId, cronExpression: record.cronExpression }, 'Heartbeat started');
        }
    }
    stop() {
        for (const [agentId, task] of this.jobs) {
            task.stop();
            const status = this.status.get(agentId);
            if (status) {
                status.isActive = false;
            }
        }
        this.jobs.clear();
        this.logger.info({}, 'All heartbeats stopped');
    }
    async wakeAgent(agentId) {
        const status = this.status.get(agentId);
        if (!status) {
            this.logger.warn({ agentId }, 'No heartbeat registered for agent');
            return;
        }
        this.logger.info({ agentId }, 'Agent waking up');
        this.broadcast({
            type: 'heartbeat:wake',
            payload: { agentId },
            timestamp: Date.now(),
        });
        status.lastWakeAt = Date.now();
        status.nextWakeAt = this.calculateNextWake(status.cronExpression);
        try {
            const agent = this.agentRegistry.get(agentId);
            if (!agent) {
                throw new Error('Agent not found');
            }
            const workspace = this.createWorkspace(agentId);
            let working = workspace.readWorking();
            let memory = workspace.readMemory();
            let inboxInfo = '';
            let mentionsInfo = '';
            if (this.communication) {
                const inbox = this.communication.getInbox(agentId);
                if (inbox.length > 0) {
                    const summarized = inbox.slice(0, 3).map((m) => `From @${m.fromAgentId}: ${m.content.slice(0, 100)}...`).join('\n');
                    inboxInfo = `\n\nINBOX (${inbox.length} messages):\n${summarized}`;
                }
                const mentions = this.communication.getMentions(agentId);
                if (mentions.length > 0) {
                    const summarizedMentions = mentions.slice(0, 3).map((m) => `@${m.fromAgentId} mentioned you`).join('\n');
                    mentionsInfo = `\n\nMENTIONS (${mentions.length}):\n${summarizedMentions}`;
                }
            }
            let prompt;
            if (working || memory || inboxInfo || mentionsInfo) {
                prompt = buildWakePrompt(working, memory);
                if (inboxInfo)
                    prompt += inboxInfo;
                if (mentionsInfo)
                    prompt += mentionsInfo;
                prompt += '\n\nIf you have messages or mentions, address them before checking other work.';
            }
            else {
                prompt = buildStandbyPrompt();
            }
            const result = await this.harness.execute(agent, {
                id: `heartbeat-${agentId}-${Date.now()}`,
                agentId,
                input: prompt,
                priority: 'low',
                createdAt: Date.now(),
            });
            const parsed = parseHeartbeatResponse(result.output);
            status.lastStatus = parsed.status;
            status.consecutiveErrors = 0;
            if (parsed.status === 'worked') {
                workspace.updateWorking(parsed.summary);
                workspace.logDaily(`Heartbeat work: ${parsed.summary}`);
            }
            else {
                workspace.logDaily('Heartbeat: No work to do');
            }
            if (this.communication) {
                this.communication.addHeartbeatActivity(agentId, parsed.status);
            }
            this.broadcast({
                type: 'heartbeat:result',
                payload: {
                    agentId,
                    status: parsed.status,
                    summary: parsed.summary,
                    tokensUsed: result.usage.totalTokens,
                },
                timestamp: Date.now(),
            });
            this.save();
            this.logger.info({ agentId, status: parsed.status }, 'Heartbeat cycle completed');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            status.lastStatus = 'error';
            status.consecutiveErrors++;
            this.logger.error({ agentId, error: message }, 'Heartbeat error');
            this.broadcast({
                type: 'heartbeat:error',
                payload: { agentId, error: message },
                timestamp: Date.now(),
            });
            if (status.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                this.logger.warn({ agentId }, 'Too many consecutive errors, deactivating heartbeat');
                this.unregister(agentId);
                this.broadcast({
                    type: 'heartbeat:deactivated',
                    payload: { agentId, reason: 'Too many consecutive errors' },
                    timestamp: Date.now(),
                });
            }
            this.save();
        }
        this.broadcast({
            type: 'heartbeat:sleep',
            payload: { agentId },
            timestamp: Date.now(),
        });
    }
    wakeNow(agentId) {
        const status = this.status.get(agentId);
        if (!status) {
            this.logger.warn({ agentId }, 'No heartbeat registered');
            return false;
        }
        setImmediate(() => this.wakeAgent(agentId));
        return true;
    }
    getStatus() {
        return Array.from(this.status.values()).map((s) => ({
            ...s,
            nextWakeAt: s.isActive ? this.calculateNextWake(s.cronExpression) : undefined,
        }));
    }
    calculateNextWake(cronExpression) {
        const now = new Date();
        const next = new Date(now);
        next.setSeconds(0);
        next.setMilliseconds(0);
        next.setMinutes(next.getMinutes() + 1);
        return next.getTime();
    }
    loadRecords() {
        try {
            if (existsSync(HEARTBEATS_FILE)) {
                const data = readFileSync(HEARTBEATS_FILE, 'utf-8');
                return JSON.parse(data);
            }
        }
        catch (error) {
            this.logger.error({}, 'Failed to load heartbeats');
        }
        return {};
    }
    load() {
        const records = this.loadRecords();
        this.logger.info({ count: Object.keys(records).length }, 'Heartbeats loaded');
    }
    save() {
        try {
            const records = {};
            for (const [agentId, status] of this.status) {
                records[agentId] = {
                    agentId,
                    cronExpression: status.cronExpression,
                    consecutiveErrors: status.consecutiveErrors,
                };
            }
            writeFileSync(HEARTBEATS_FILE, JSON.stringify(records, null, 2), 'utf-8');
        }
        catch (error) {
            this.logger.error({}, 'Failed to save heartbeats');
        }
    }
}
//# sourceMappingURL=heartbeat.js.map