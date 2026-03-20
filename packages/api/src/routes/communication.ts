import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import pino from 'pino';
import type { AgentCommunication } from '@trustmebro/core';
import type { ApiResponse } from '../types.js';

const logger = pino({ name: 'CommunicationRoutes' });

let communication: AgentCommunication | null = null;

export function setCommunication(comm: AgentCommunication): void {
  communication = comm;
}

const sendMessageSchema = z.object({
  toAgentId: z.string().min(1),
  content: z.string().min(1),
  threadId: z.string().optional(),
});

const createThreadSchema = z.object({
  title: z.string().min(1),
  participantIds: z.array(z.string()).min(1),
  taskId: z.string().optional(),
});

const postToThreadSchema = z.object({
  fromAgentId: z.string().min(1),
  content: z.string().min(1),
});

const broadcastSchema = z.object({
  fromAgentId: z.string().min(1),
  content: z.string().min(1),
});

export async function communicationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/agents/:id/inbox', async (request, reply) => {
    try {
      if (!communication) {
        return reply.code(500).send({ success: false, error: 'Communication not initialized', timestamp: Date.now() });
      }

      const messages = communication.getInbox(request.params.id);
      return reply.send({ success: true, data: messages, timestamp: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/agents/:id/mentions', async (request, reply) => {
    try {
      if (!communication) {
        return reply.code(500).send({ success: false, error: 'Communication not initialized', timestamp: Date.now() });
      }

      const mentions = communication.getMentions(request.params.id);
      return reply.send({ success: true, data: mentions, timestamp: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof sendMessageSchema>;
    Reply: ApiResponse;
  }>('/api/agents/:id/messages', async (request, reply) => {
    try {
      if (!communication) {
        return reply.code(500).send({ success: false, error: 'Communication not initialized', timestamp: Date.now() });
      }

      const parsed = sendMessageSchema.parse(request.body);
      const message = communication.send(request.params.id, parsed.toAgentId, parsed.content, parsed.threadId);

      return reply.code(201).send({ success: true, data: message, timestamp: Date.now() });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ success: false, error: error.errors.map((e) => e.message).join(', '), timestamp: Date.now() });
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.get<{ Reply: ApiResponse }>('/api/threads', async (_request, reply) => {
    try {
      if (!communication) {
        return reply.code(500).send({ success: false, error: 'Communication not initialized', timestamp: Date.now() });
      }

      const feed = communication.getActivityFeed(100);
      const threads = feed.filter((item) => item.type === 'thread_created');
      return reply.send({ success: true, data: threads, timestamp: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.post<{
    Body: z.infer<typeof createThreadSchema>;
    Reply: ApiResponse;
  }>('/api/threads', async (request, reply) => {
    try {
      if (!communication) {
        return reply.code(500).send({ success: false, error: 'Communication not initialized', timestamp: Date.now() });
      }

      const parsed = createThreadSchema.parse(request.body);
      const thread = communication.createThread(parsed.title, parsed.participantIds, parsed.taskId);

      return reply.code(201).send({ success: true, data: thread, timestamp: Date.now() });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ success: false, error: error.errors.map((e) => e.message).join(', '), timestamp: Date.now() });
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/threads/:id', async (request, reply) => {
    try {
      if (!communication) {
        return reply.code(500).send({ success: false, error: 'Communication not initialized', timestamp: Date.now() });
      }

      const thread = communication.getThread(request.params.id);
      if (!thread) {
        return reply.code(404).send({ success: false, error: 'Thread not found', timestamp: Date.now() });
      }

      return reply.send({ success: true, data: thread, timestamp: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof postToThreadSchema>;
    Reply: ApiResponse;
  }>('/api/threads/:id/messages', async (request, reply) => {
    try {
      if (!communication) {
        return reply.code(500).send({ success: false, error: 'Communication not initialized', timestamp: Date.now() });
      }

      const parsed = postToThreadSchema.parse(request.body);
      const message = communication.postToThread(request.params.id, parsed.fromAgentId, parsed.content);

      return reply.code(201).send({ success: true, data: message, timestamp: Date.now() });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ success: false, error: error.errors.map((e) => e.message).join(', '), timestamp: Date.now() });
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.get<{
    Querystring: { limit?: string };
    Reply: ApiResponse;
  }>('/api/activity', async (request, reply) => {
    try {
      if (!communication) {
        return reply.code(500).send({ success: false, error: 'Communication not initialized', timestamp: Date.now() });
      }

      const limit = parseInt(request.query.limit ?? '50', 10);
      const feed = communication.getActivityFeed(limit);

      return reply.send({ success: true, data: feed, timestamp: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.post<{
    Body: z.infer<typeof broadcastSchema>;
    Reply: ApiResponse;
  }>('/api/agents/broadcast', async (request, reply) => {
    try {
      if (!communication) {
        return reply.code(500).send({ success: false, error: 'Communication not initialized', timestamp: Date.now() });
      }

      const parsed = broadcastSchema.parse(request.body);
      communication.broadcast(parsed.fromAgentId, parsed.content);

      return reply.send({ success: true, data: { broadcast: true }, timestamp: Date.now() });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ success: false, error: error.errors.map((e) => e.message).join(', '), timestamp: Date.now() });
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });
}
