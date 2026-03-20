import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ApiResponse } from '../types.js';
import type { MetaAgent } from '@trustmebro/core';

let metaAgent: MetaAgent | null = null;

export function setMetaAgent(agent: MetaAgent): void {
  metaAgent = agent;
}

const chatSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
});

export async function metaRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{
    Body: z.infer<typeof chatSchema>;
    Reply: ApiResponse;
  }>('/api/meta/chat', async (request, reply) => {
    if (!metaAgent) {
      return reply.code(500).send({
        success: false,
        error: 'MetaAgent not initialized',
        timestamp: Date.now(),
      });
    }

    try {
      const parsed = chatSchema.parse(request.body);
      const result = await metaAgent.chat(parsed.message, parsed.conversationId);

      return reply.send({
        success: true,
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: error.errors.map((e) => e.message).join(', '),
          timestamp: Date.now(),
        });
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({
        success: false,
        error: message,
        timestamp: Date.now(),
      });
    }
  });

  fastify.get('/api/meta/conversations', async (_request, reply) => {
    if (!metaAgent) {
      return reply.code(500).send({
        success: false,
        error: 'MetaAgent not initialized',
        timestamp: Date.now(),
      });
    }

    return reply.send({
      success: true,
      data: metaAgent.listConversations(),
      timestamp: Date.now(),
    });
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/meta/conversations/:id', async (request, reply) => {
    if (!metaAgent) {
      return reply.code(500).send({
        success: false,
        error: 'MetaAgent not initialized',
        timestamp: Date.now(),
      });
    }

    const conversation = metaAgent.getConversation(request.params.id);
    if (!conversation) {
      return reply.code(404).send({
        success: false,
        error: 'Conversation not found',
        timestamp: Date.now(),
      });
    }

    return reply.send({
      success: true,
      data: conversation,
      timestamp: Date.now(),
    });
  });

  fastify.delete<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/meta/conversations/:id', async (request, reply) => {
    if (!metaAgent) {
      return reply.code(500).send({
        success: false,
        error: 'MetaAgent not initialized',
        timestamp: Date.now(),
      });
    }

    const deleted = metaAgent.deleteConversation(request.params.id);
    if (!deleted) {
      return reply.code(404).send({
        success: false,
        error: 'Conversation not found',
        timestamp: Date.now(),
      });
    }

    return reply.send({
      success: true,
      data: { deleted: true },
      timestamp: Date.now(),
    });
  });
}
