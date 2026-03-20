import { randomUUID } from 'crypto';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import pino from 'pino';
import Database from 'better-sqlite3';
import type { AgentRegistry } from './index.js';

export interface Message {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  content: string;
  threadId?: string;
  delivered: boolean;
  read: boolean;
  createdAt: number;
}

export interface Thread {
  id: string;
  title: string;
  taskId?: string;
  participantIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Mention {
  id: number;
  mentionedAgentId: string;
  fromAgentId: string;
  messageId: string;
  delivered: boolean;
  createdAt: number;
}

export interface ActivityItem {
  id: string;
  type: 'message_sent' | 'mention' | 'thread_created' | 'task_completed' | 'heartbeat';
  agentId: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export class AgentCommunication {
  private db: Database.Database;
  private agentRegistry: AgentRegistry;
  private emitEvent: (event: { type: string; payload: unknown; timestamp: number }) => void;
  private logger: pino.Logger;

  constructor(
    agentRegistry: AgentRegistry,
    basePath: string = './data/comms',
    broadcast?: (event: { type: string; payload: unknown; timestamp: number }) => void,
    logger?: pino.Logger
  ) {
    this.agentRegistry = agentRegistry;
    this.emitEvent = broadcast ?? (() => {});
    this.logger = logger ?? pino({ name: 'AgentCommunication' });

    if (!existsSync(basePath)) {
      mkdirSync(basePath, { recursive: true });
    }

    this.db = new Database(join(basePath, 'comms.db'));
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        from_agent_id TEXT NOT NULL,
        to_agent_id TEXT NOT NULL,
        content TEXT NOT NULL,
        thread_id TEXT,
        delivered INTEGER DEFAULT 0,
        read INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        task_id TEXT,
        participant_ids TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mentions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mentioned_agent_id TEXT NOT NULL,
        from_agent_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        delivered INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS activity (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_agent_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_mentions_agent ON mentions(mentioned_agent_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at)`);
  }

  send(fromAgentId: string, toAgentId: string, content: string, threadId?: string): Message {
    const id = randomUUID();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO messages (id, from_agent_id, to_agent_id, content, thread_id, delivered, read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, 0, ?)
    `).run(id, fromAgentId, toAgentId, content, threadId ?? null, now);

    const message: Message = {
      id,
      fromAgentId,
      toAgentId,
      content,
      threadId,
      delivered: false,
      read: false,
      createdAt: now,
    };

    this.addActivity('message_sent', fromAgentId, `Sent message to ${toAgentId}`);

    this.emitEvent({
      type: 'message:new',
      payload: { fromAgentId, toAgentId, content, threadId, messageId: id },
      timestamp: now,
    });

    this.logger.info({ fromAgentId, toAgentId, messageId: id }, 'Message sent');

    const mentions = this.extractMentions(content);
    for (const mentionedId of mentions) {
      this.createMention(mentionedId, fromAgentId, id);
    }

    return message;
  }

  private extractMentions(content: string): string[] {
    const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      if (match[1]) {
        mentions.push(match[1]);
      }
    }

    return mentions;
  }

  private createMention(mentionedAgentId: string, fromAgentId: string, messageId: string): void {
    const id = this.db.prepare(`
      INSERT INTO mentions (mentioned_agent_id, from_agent_id, message_id, delivered, created_at)
      VALUES (?, ?, ?, 0, ?)
    `).run(mentionedAgentId, fromAgentId, messageId, Date.now());

    this.addActivity('mention', fromAgentId, `Mentioned @${mentionedAgentId}`);

    this.emitEvent({
      type: 'mention:new',
      payload: { mentionedAgentId, fromAgentId, messageId },
      timestamp: Date.now(),
    });

    this.logger.info({ mentionedAgentId, fromAgentId }, 'Mention created');
  }

  getInbox(agentId: string): Message[] {
    const rows = this.db.prepare(`
      SELECT * FROM messages WHERE to_agent_id = ? ORDER BY created_at DESC LIMIT 50
    `).all(agentId) as Array<{
      id: string;
      from_agent_id: string;
      to_agent_id: string;
      content: string;
      thread_id: string | null;
      delivered: number;
      read: number;
      created_at: number;
    }>;

    this.db.prepare(`
      UPDATE messages SET delivered = 1 WHERE to_agent_id = ? AND delivered = 0
    `).run(agentId);

    return rows.map((row) => ({
      id: row.id,
      fromAgentId: row.from_agent_id,
      toAgentId: row.to_agent_id,
      content: row.content,
      threadId: row.thread_id ?? undefined,
      delivered: true,
      read: row.read === 1,
      createdAt: row.created_at,
    }));
  }

  getMentions(agentId: string): Mention[] {
    const rows = this.db.prepare(`
      SELECT m.*, msg.content, msg.from_agent_id as msg_from_id
      FROM mentions m
      JOIN messages msg ON m.message_id = msg.id
      WHERE m.mentioned_agent_id = ? AND m.delivered = 0
      ORDER BY m.created_at DESC LIMIT 50
    `).all(agentId) as Array<{
      id: number;
      mentioned_agent_id: string;
      from_agent_id: string;
      message_id: string;
      delivered: number;
      created_at: number;
    }>;

    this.db.prepare(`
      UPDATE mentions SET delivered = 1 WHERE mentioned_agent_id = ? AND delivered = 0
    `).run(agentId);

    return rows.map((row) => ({
      id: row.id,
      mentionedAgentId: row.mentioned_agent_id,
      fromAgentId: row.from_agent_id,
      messageId: row.message_id,
      delivered: true,
      createdAt: row.created_at,
    }));
  }

  createThread(title: string, participantIds: string[], taskId?: string): Thread {
    const id = randomUUID();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO threads (id, title, task_id, participant_ids, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, title, taskId ?? null, JSON.stringify(participantIds), now, now);

    const thread: Thread = {
      id,
      title,
      taskId,
      participantIds,
      createdAt: now,
      updatedAt: now,
    };

    this.addActivity('thread_created', participantIds[0] || 'system', `Created thread: ${title}`);

    this.emitEvent({
      type: 'thread:created',
      payload: { threadId: id, title, participantIds },
      timestamp: now,
    });

    this.logger.info({ threadId: id, title }, 'Thread created');

    return thread;
  }

  postToThread(threadId: string, fromAgentId: string, content: string): Message {
    const thread = this.getThread(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    const message = this.send(fromAgentId, thread.thread.participantIds.join(','), content, threadId);

    this.db.prepare(`
      UPDATE threads SET updated_at = ? WHERE id = ?
    `).run(Date.now(), threadId);

    this.emitEvent({
      type: 'thread:updated',
      payload: { threadId, fromAgentId },
      timestamp: Date.now(),
    });

    return message;
  }

  getThread(threadId: string): { thread: Thread; messages: Message[] } | null {
    const row = this.db.prepare(`
      SELECT * FROM threads WHERE id = ?
    `).get(threadId) as {
      id: string;
      title: string;
      task_id: string | null;
      participant_ids: string;
      created_at: number;
      updated_at: number;
    } | undefined;

    if (!row) return null;

    const thread: Thread = {
      id: row.id,
      title: row.title,
      taskId: row.task_id ?? undefined,
      participantIds: JSON.parse(row.participant_ids),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    const messageRows = this.db.prepare(`
      SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 1000
    `).all(threadId) as Array<{
      id: string;
      from_agent_id: string;
      to_agent_id: string;
      content: string;
      thread_id: string | null;
      delivered: number;
      read: number;
      created_at: number;
    }>;

    const messages: Message[] = messageRows.map((msgRow) => ({
      id: msgRow.id,
      fromAgentId: msgRow.from_agent_id,
      toAgentId: msgRow.to_agent_id,
      content: msgRow.content,
      threadId: msgRow.thread_id ?? undefined,
      delivered: msgRow.delivered === 1,
      read: msgRow.read === 1,
      createdAt: msgRow.created_at,
    }));

    return { thread, messages };
  }

  getActivityFeed(limit: number = 50): ActivityItem[] {
    const rows = this.db.prepare(`
      SELECT * FROM activity ORDER BY created_at DESC LIMIT ?
    `).all(limit) as Array<{
      id: string;
      type: string;
      agent_id: string;
      content: string;
      metadata: string | null;
      created_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      type: row.type as ActivityItem['type'],
      agentId: row.agent_id,
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
    }));
  }

  broadcast(fromAgentId: string, content: string): void {
    const agents = this.agentRegistry.list();

    for (const agent of agents) {
      if (agent.id !== fromAgentId) {
        this.send(fromAgentId, agent.id, content);
      }
    }

    this.logger.info({ fromAgentId, recipientCount: agents.length - 1 }, 'Broadcast sent');
  }

  private addActivity(
    type: ActivityItem['type'],
    agentId: string,
    content: string,
    metadata?: Record<string, unknown>
  ): void {
    const id = randomUUID();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO activity (id, type, agent_id, content, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, type, agentId, content, metadata ? JSON.stringify(metadata) : null, now);

    this.emitEvent({
      type: 'activity:new',
      payload: { id, type, agentId, content, metadata },
      timestamp: now,
    });
  }

  addTaskActivity(agentId: string, taskId: string, summary: string): void {
    this.addActivity('task_completed', agentId, summary, { taskId });
  }

  addHeartbeatActivity(agentId: string, status: string): void {
    this.addActivity('heartbeat', agentId, `Heartbeat: ${status}`);
  }

  getUnreadCount(agentId: string): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE to_agent_id = ? AND delivered = 0
    `).get(agentId) as { count: number };

    const mentionsResult = this.db.prepare(`
      SELECT COUNT(*) as count FROM mentions WHERE mentioned_agent_id = ? AND delivered = 0
    `).get(agentId) as { count: number };

    return result.count + mentionsResult.count;
  }

  close(): void {
    this.db.close();
  }
}
