import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { KnowledgeBase, type KnowledgeEntry, type KnowledgeType } from '@trustmebro/core';
import type { ApiResponse } from '../types.js';

let knowledgeBase: KnowledgeBase | null = null;

export function setKnowledgeBase(kb: KnowledgeBase): void {
  knowledgeBase = kb;
}

export function getKnowledgeBase(): KnowledgeBase | null {
  return knowledgeBase;
}

const knowledgeEntrySchema = z.object({
  agentId: z.string().min(1),
  type: z.enum(['error', 'success', 'skill', 'document', 'fact', 'preference']),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

const searchSchema = z.object({
  query: z.string().min(1),
  agentId: z.string().optional(),
  types: z.array(z.enum(['error', 'success', 'skill', 'document', 'fact', 'preference'])).optional(),
  limit: z.number().min(1).max(50).default(5),
  minScore: z.number().min(0).max(1).default(0.5),
});

const errorShortcutSchema = z.object({
  agentId: z.string().min(1),
  task: z.string().min(1),
  error: z.string().min(1),
  solution: z.string().optional(),
});

const successShortcutSchema = z.object({
  agentId: z.string().min(1),
  task: z.string().min(1),
  approach: z.string().min(1),
});

export async function knowledgeRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/knowledge', async (request, reply) => {
    if (!knowledgeBase) {
      return reply.code(500).send({
        success: false,
        error: 'KnowledgeBase not initialized',
        timestamp: Date.now(),
      });
    }

    const { agentId, type } = request.query as { agentId?: string; type?: KnowledgeType };

    if (!agentId) {
      return reply.code(400).send({
        success: false,
        error: 'agentId query parameter is required',
        timestamp: Date.now(),
      });
    }

    const entries = knowledgeBase.list(agentId, type);

    return reply.send({
      success: true,
      data: entries,
      timestamp: Date.now(),
    });
  });

  fastify.post<{
    Body: z.infer<typeof knowledgeEntrySchema>;
    Reply: ApiResponse;
  }>('/api/knowledge', async (request, reply) => {
    if (!knowledgeBase) {
      return reply.code(500).send({
        success: false,
        error: 'KnowledgeBase not initialized',
        timestamp: Date.now(),
      });
    }

    try {
      const parsed = knowledgeEntrySchema.parse(request.body);

      const entry = await knowledgeBase.add(parsed);

      return reply.send({
        success: true,
        data: entry,
        timestamp: Date.now(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
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

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/knowledge/:id', async (request, reply) => {
    if (!knowledgeBase) {
      return reply.code(500).send({
        success: false,
        error: 'KnowledgeBase not initialized',
        timestamp: Date.now(),
      });
    }

    const entry = knowledgeBase.get(request.params.id);

    if (!entry) {
      return reply.code(404).send({
        success: false,
        error: 'Knowledge entry not found',
        timestamp: Date.now(),
      });
    }

    return reply.send({
      success: true,
      data: entry,
      timestamp: Date.now(),
    });
  });

  fastify.delete<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/knowledge/:id', async (request, reply) => {
    if (!knowledgeBase) {
      return reply.code(500).send({
        success: false,
        error: 'KnowledgeBase not initialized',
        timestamp: Date.now(),
      });
    }

    knowledgeBase.remove(request.params.id);

    return reply.send({
      success: true,
      data: { deleted: true },
      timestamp: Date.now(),
    });
  });

  fastify.post<{
    Body: z.infer<typeof searchSchema>;
    Reply: ApiResponse;
  }>('/api/knowledge/search', async (request, reply) => {
    if (!knowledgeBase) {
      return reply.code(500).send({
        success: false,
        error: 'KnowledgeBase not initialized',
        timestamp: Date.now(),
      });
    }

    try {
      const parsed = searchSchema.parse(request.body);

      const results = await knowledgeBase.search(parsed.query, {
        agentId: parsed.agentId,
        types: parsed.types,
        limit: parsed.limit,
        minScore: parsed.minScore,
      });

      return reply.send({
        success: true,
        data: results,
        timestamp: Date.now(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
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

  fastify.post<{
    Body: z.infer<typeof errorShortcutSchema>;
    Reply: ApiResponse;
  }>('/api/knowledge/error', async (request, reply) => {
    if (!knowledgeBase) {
      return reply.code(500).send({
        success: false,
        error: 'KnowledgeBase not initialized',
        timestamp: Date.now(),
      });
    }

    try {
      const parsed = errorShortcutSchema.parse(request.body);

      const entry = await knowledgeBase.addError(
        parsed.agentId,
        parsed.task,
        parsed.error,
        parsed.solution
      );

      return reply.send({
        success: true,
        data: entry,
        timestamp: Date.now(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
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

  fastify.post<{
    Body: z.infer<typeof successShortcutSchema>;
    Reply: ApiResponse;
  }>('/api/knowledge/success', async (request, reply) => {
    if (!knowledgeBase) {
      return reply.code(500).send({
        success: false,
        error: 'KnowledgeBase not initialized',
        timestamp: Date.now(),
      });
    }

    try {
      const parsed = successShortcutSchema.parse(request.body);

      const entry = await knowledgeBase.addSuccess(
        parsed.agentId,
        parsed.task,
        parsed.approach
      );

      return reply.send({
        success: true,
        data: entry,
        timestamp: Date.now(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
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

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/agents/:id/knowledge', async (request, reply) => {
    if (!knowledgeBase) {
      return reply.code(500).send({
        success: false,
        error: 'KnowledgeBase not initialized',
        timestamp: Date.now(),
      });
    }

    const { type } = request.query as { type?: KnowledgeType };
    const entries = knowledgeBase.list(request.params.id, type);

    return reply.send({
      success: true,
      data: entries,
      timestamp: Date.now(),
    });
  });

  fastify.get('/api/knowledge/global', async (_request, reply) => {
    if (!knowledgeBase) {
      return reply.code(500).send({
        success: false,
        error: 'KnowledgeBase not initialized',
        timestamp: Date.now(),
      });
    }

    const entries = knowledgeBase.list('global');

    return reply.send({
      success: true,
      data: entries,
      timestamp: Date.now(),
    });
  });

  fastify.get('/api/knowledge/stats', async (request, reply) => {
    if (!knowledgeBase) {
      return reply.code(500).send({
        success: false,
        error: 'KnowledgeBase not initialized',
        timestamp: Date.now(),
      });
    }

    const { agentId } = request.query as { agentId?: string };
    const stats = knowledgeBase.getStats(agentId);

    return reply.send({
      success: true,
      data: stats,
      timestamp: Date.now(),
    });
  });
}
