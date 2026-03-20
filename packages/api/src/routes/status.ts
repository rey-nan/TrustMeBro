import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db.js';
import type { ApiResponse } from '../types.js';
import { LLMClient, type ProviderName, type Harness, type ReasoningLevel } from '@trustmebro/core';
import { harnessInstance } from './tasks.js';

let llmClient: LLMClient | null = null;

export function setLlmClient(client: LLMClient): void {
  llmClient = client;
}

const switchProviderSchema = z.object({
  provider: z.enum(['openrouter', 'ollama', 'groq', 'openai-compatible']),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
});

const startTime = Date.now();

const PROVIDERS: Array<{ name: ProviderName; description: string }> = [
  { name: 'openrouter', description: 'OpenRouter AI Gateway' },
  { name: 'ollama', description: 'Ollama Local Models' },
  { name: 'groq', description: 'Groq Cloud' },
  { name: 'openai-compatible', description: 'OpenAI Compatible API' },
];

export async function statusRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (_request, reply) => {
    return reply.send({ ok: true, timestamp: Date.now() });
  });

  fastify.get('/api/status', async (_request, reply) => {
    const agentCount = (db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number }).count;
    const taskCount = (db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }).count;

    return reply.send({
      success: true,
      data: {
        version: '0.1.0',
        uptime: Date.now() - startTime,
        activeProvider: llmClient?.getCurrentProvider() ?? 'unknown',
        agentsRegistered: agentCount,
        totalTasks: taskCount,
      },
      timestamp: Date.now(),
    });
  });

  fastify.get('/api/providers', async (_request, reply) => {
    const currentProvider = llmClient?.getCurrentProvider() ?? 'unknown';

    const providersWithStatus = await Promise.all(
      PROVIDERS.map(async (p) => ({
        ...p,
        isActive: p.name === currentProvider,
        isAvailable: llmClient?.getCurrentProvider() === p.name
          ? await llmClient?.isAvailable() ?? false
          : undefined,
      }))
    );

    return reply.send({
      success: true,
      data: providersWithStatus,
      timestamp: Date.now(),
    });
  });

  fastify.post<{
    Body: z.infer<typeof switchProviderSchema>;
    Reply: ApiResponse;
  }>('/api/providers/switch', async (request, reply) => {
    try {
      if (!llmClient) {
        return reply.code(500).send({
          success: false,
          error: 'LLM Client not initialized',
          timestamp: Date.now(),
        });
      }

      const parsed = switchProviderSchema.parse(request.body);

      llmClient.switchProvider(parsed.provider, {
        apiKey: parsed.apiKey,
        baseUrl: parsed.baseUrl,
        defaultModel: parsed.model,
      });

      return reply.send({
        success: true,
        data: {
          provider: parsed.provider,
          switched: true,
        },
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

  const reasoningBudgetSchema = z.object({
    planning: z.enum(['low', 'medium', 'high', 'xhigh']),
    execution: z.enum(['low', 'medium', 'high', 'xhigh']),
    verification: z.enum(['low', 'medium', 'high', 'xhigh']),
  });

  fastify.get('/api/reasoning-budget', async (_request, reply) => {
    if (!harnessInstance) {
      return reply.code(500).send({
        success: false,
        error: 'Harness not initialized',
        timestamp: Date.now(),
      });
    }

    const config = harnessInstance.getReasoningBudget().getConfig();

    return reply.send({
      success: true,
      data: config,
      timestamp: Date.now(),
    });
  });

  fastify.post<{
    Body: z.infer<typeof reasoningBudgetSchema>;
    Reply: ApiResponse;
  }>('/api/reasoning-budget', async (request, reply) => {
    if (!harnessInstance) {
      return reply.code(500).send({
        success: false,
        error: 'Harness not initialized',
        timestamp: Date.now(),
      });
    }

    try {
      const parsed = reasoningBudgetSchema.parse(request.body);

      harnessInstance.getReasoningBudget().setConfig({
        default: {
          planning: parsed.planning,
          execution: parsed.execution,
          verification: parsed.verification,
        },
      });

      return reply.send({
        success: true,
        data: {
          planning: parsed.planning,
          execution: parsed.execution,
          verification: parsed.verification,
        },
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
}
