import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db.js';
import type { ApiResponse } from '../types.js';
import { AgentRegistry } from '@trustmebro/core';

let agentRegistry: AgentRegistry | null = null;

export function setAgentRegistry(registry: AgentRegistry): void {
  agentRegistry = registry;
}

export function getAgentRegistry(): AgentRegistry {
  if (!agentRegistry) {
    agentRegistry = new AgentRegistry('./data/agents.json');
  }
  return agentRegistry;
}

const createAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  systemPrompt: z.string().min(1),
  model: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  timeoutMs: z.number().optional(),
  maxRetries: z.number().optional(),
});

const updateAgentSchema = createAgentSchema.partial().omit({ id: true });

export async function agentsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Reply: ApiResponse }>('/api/agents', async (_request, reply) => {
    try {
      const agents = getAgentRegistry().list();
      return reply.send({
        success: true,
        data: agents,
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

  fastify.post<{
    Body: z.infer<typeof createAgentSchema>;
    Reply: ApiResponse;
  }>('/api/agents', async (request, reply) => {
    try {
      const parsed = createAgentSchema.parse(request.body);

      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO agents (id, name, description, system_prompt, model, temperature, max_tokens, timeout_ms, max_retries, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        parsed.id,
        parsed.name,
        parsed.description,
        parsed.systemPrompt,
        parsed.model ?? null,
        parsed.temperature ?? null,
        parsed.maxTokens ?? null,
        parsed.timeoutMs ?? null,
        parsed.maxRetries ?? null,
        Date.now()
      );

      getAgentRegistry().register({
        id: parsed.id,
        name: parsed.name,
        description: parsed.description,
        systemPrompt: parsed.systemPrompt,
        model: parsed.model,
        temperature: parsed.temperature,
        maxTokens: parsed.maxTokens,
        timeoutMs: parsed.timeoutMs,
        maxRetries: parsed.maxRetries,
      });

      return reply.code(201).send({
        success: true,
        data: { id: parsed.id },
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
  }>('/api/agents/:id', async (request, reply) => {
    try {
      const agent = getAgentRegistry().get(request.params.id);

      if (!agent) {
        return reply.code(404).send({
          success: false,
          error: 'Agent not found',
          timestamp: Date.now(),
        });
      }

      return reply.send({
        success: true,
        data: agent,
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

  fastify.put<{
    Params: { id: string };
    Body: z.infer<typeof updateAgentSchema>;
    Reply: ApiResponse;
  }>('/api/agents/:id', async (request, reply) => {
    try {
      const existing = getAgentRegistry().get(request.params.id);
      if (!existing) {
        return reply.code(404).send({
          success: false,
          error: 'Agent not found',
          timestamp: Date.now(),
        });
      }

      const parsed = updateAgentSchema.parse(request.body);
      const updated = { ...existing, ...parsed };

      getAgentRegistry().register(updated);

      const updateStmt = db.prepare(`
        UPDATE agents SET name = ?, description = ?, system_prompt = ?, model = ?, temperature = ?, max_tokens = ?, timeout_ms = ?, max_retries = ?
        WHERE id = ?
      `);

      updateStmt.run(
        updated.name,
        updated.description,
        updated.systemPrompt,
        updated.model ?? null,
        updated.temperature ?? null,
        updated.maxTokens ?? null,
        updated.timeoutMs ?? null,
        updated.maxRetries ?? null,
        request.params.id
      );

      return reply.send({
        success: true,
        data: updated,
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

  fastify.delete<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/agents/:id', async (request, reply) => {
    try {
      const deleted = getAgentRegistry().remove(request.params.id);

      if (!deleted) {
        return reply.code(404).send({
          success: false,
          error: 'Agent not found',
          timestamp: Date.now(),
        });
      }

      db.prepare('DELETE FROM agents WHERE id = ?').run(request.params.id);

      return reply.send({
        success: true,
        data: { deleted: true },
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

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/agents/:id/stats', async (request, reply) => {
    try {
      const agent = getAgentRegistry().get(request.params.id);
      if (!agent) {
        return reply.code(404).send({
          success: false,
          error: 'Agent not found',
          timestamp: Date.now(),
        });
      }

      const stmt = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
          SUM(input_tokens) as totalInputTokens,
          SUM(output_tokens) as totalOutputTokens,
          AVG(duration_ms) as avgDuration
        FROM tasks WHERE agent_id = ?
      `);

      const stats = stmt.get(request.params.id) as {
        total: number;
        success: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        avgDuration: number;
      };

      return reply.send({
        success: true,
        data: {
          totalTasks: stats.total ?? 0,
          successfulTasks: stats.success ?? 0,
          successRate: stats.total ? (stats.success ?? 0) / stats.total : 0,
          totalInputTokens: stats.totalInputTokens ?? 0,
          totalOutputTokens: stats.totalOutputTokens ?? 0,
          avgDurationMs: Math.round(stats.avgDuration ?? 0),
        },
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
}
