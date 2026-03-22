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
  soulExtras: z.string().optional(),
  model: z.string().optional(),
});

const META_CONFIG_PATH = path.join(process.cwd(), 'data', 'meta-config.json');

interface MetaConfig {
  soulExtras: string;
  model: string;
}

function loadMetaConfig(): MetaConfig {
  try {
    if (fs.existsSync(META_CONFIG_PATH)) {
      const loaded = JSON.parse(fs.readFileSync(META_CONFIG_PATH, 'utf-8'));
      // Migrate old systemPrompt field to soulExtras
      if (loaded.systemPrompt && !loaded.soulExtras) {
        loaded.soulExtras = loaded.systemPrompt;
        delete loaded.systemPrompt;
        saveMetaConfig(loaded);
      }
      return loaded;
    }
  } catch {}
  return {
    soulExtras: '',
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
        soulExtras: config.soulExtras,
        model: config.model,
        currentModel: process.env.LLM_DEFAULT_MODEL || 'not set',
        provider: process.env.LLM_PROVIDER || 'not set',
        note: 'Base SOUL is hardcoded. This field adds extra traits on top.',
      },
      timestamp: Date.now(),
    });
  });

  // Update Meta-Agent config (only extras, not base SOUL)
  fastify.put<{
    Body: z.infer<typeof configSchema>;
    Reply: ApiResponse;
  }>('/api/meta/config', async (request, reply) => {
    try {
      const parsed = configSchema.parse(request.body);
      const current = loadMetaConfig();

      if (parsed.soulExtras !== undefined) {
        current.soulExtras = parsed.soulExtras;
      }
      if (parsed.model !== undefined) {
        current.model = parsed.model;
      }

      saveMetaConfig(current);

      return reply.send({
        success: true,
        data: { message: 'Extras saved. Base SOUL unchanged. Restart API to apply.' },
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

  // Get .env config
  fastify.get('/api/meta/env', async (_request, reply) => {
    const envPath = path.join(process.cwd(), '.env');
    const env: Record<string, string> = {};

    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
          const match = line.match(/^([^#=]+)=(.*)$/);
          if (match) env[match[1].trim()] = match[2].trim();
        }
      }
    } catch {}

    return reply.send({
      success: true,
      data: {
        LLM_PROVIDER: env.LLM_PROVIDER || '',
        LLM_API_KEY: env.LLM_API_KEY ? '••••••••' + env.LLM_API_KEY.slice(-4) : '',
        LLM_DEFAULT_MODEL: env.LLM_DEFAULT_MODEL || '',
        LLM_BASE_URL: env.LLM_BASE_URL || '',
        TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN ? '••••••••' : '',
        TELEGRAM_CHAT_ID: env.TELEGRAM_CHAT_ID || '',
      },
      timestamp: Date.now(),
    });
  });

  // Update .env config
  fastify.put<{
    Body: Record<string, string>;
    Reply: ApiResponse;
  }>('/api/meta/env', async (request, reply) => {
    const envPath = path.join(process.cwd(), '.env');
    const body = request.body as Record<string, string>;

    try {
      // Read current .env
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
      }

      // Parse and update
      const lines = envContent.split('\n');
      const updated: Record<string, string> = {};
      for (const line of lines) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) updated[match[1].trim()] = match[2].trim();
      }

      // Apply changes (skip masked values)
      const editableKeys = ['LLM_PROVIDER', 'LLM_API_KEY', 'LLM_DEFAULT_MODEL', 'LLM_BASE_URL', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
      for (const key of editableKeys) {
        if (body[key] !== undefined && !body[key].startsWith('••••')) {
          updated[key] = body[key];
        }
      }

      // Write back
      const newContent = Object.entries(updated).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
      fs.writeFileSync(envPath, newContent);

      return reply.send({
        success: true,
        data: { message: '.env saved. Restart API to apply changes.' },
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
