import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
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

const configSchema = z.object({
  systemPrompt: z.string().optional(),
  model: z.string().optional(),
});

const META_CONFIG_PATH = path.join(process.cwd(), 'data', 'meta-config.json');

interface MetaConfig {
  systemPrompt: string;
  model: string;
}

function loadMetaConfig(): MetaConfig {
  try {
    if (fs.existsSync(META_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(META_CONFIG_PATH, 'utf-8'));
    }
  } catch {}
  return {
    systemPrompt: '',
    model: process.env.LLM_DEFAULT_MODEL || 'deepseek/deepseek-chat',
  };
}

function saveMetaConfig(config: MetaConfig): void {
  const dir = path.dirname(META_CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(META_CONFIG_PATH, JSON.stringify(config, null, 2));
}

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

  // Get Meta-Agent config
  fastify.get('/api/meta/config', async (_request, reply) => {
    const config = loadMetaConfig();
    return reply.send({
      success: true,
      data: {
        ...config,
        currentModel: process.env.LLM_DEFAULT_MODEL || 'not set',
        provider: process.env.LLM_PROVIDER || 'not set',
      },
      timestamp: Date.now(),
    });
  });

  // Update Meta-Agent config
  fastify.put<{
    Body: z.infer<typeof configSchema>;
    Reply: ApiResponse;
  }>('/api/meta/config', async (request, reply) => {
    try {
      const parsed = configSchema.parse(request.body);
      const current = loadMetaConfig();

      if (parsed.systemPrompt !== undefined) {
        current.systemPrompt = parsed.systemPrompt;
      }
      if (parsed.model !== undefined) {
        current.model = parsed.model;
      }

      saveMetaConfig(current);

      return reply.send({
        success: true,
        data: { message: 'Config saved. Restart API to apply model changes.' },
        timestamp: Date.now(),
      });
    } catch (error) {
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
