import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import type { ApiResponse } from '../types.js';
import { broadcast } from '../websocket/handler.js';
import { AgentRegistry } from '@trustmebro/core';

export let harnessInstance: import('@trustmebro/core').Harness | null = null;
export let runnerInstance: import('@trustmebro/core').AgentRunner | null = null;

export function setHarnessInstance(harness: import('@trustmebro/core').Harness): void {
  harnessInstance = harness;
}

export function setRunnerInstance(runner: import('@trustmebro/core').AgentRunner): void {
  runnerInstance = runner;
}

const createTaskSchema = z.object({
  agentId: z.string().min(1),
  input: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

export async function tasksRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{
    Querystring: { page?: string; limit?: string; agentId?: string };
    Reply: ApiResponse;
  }>('/api/tasks', async (request, reply) => {
    try {
      const page = Math.max(1, parseInt(request.query.page ?? '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '20', 10)));
      const offset = (page - 1) * limit;

      let query = 'SELECT * FROM tasks';
      let countQuery = 'SELECT COUNT(*) as total FROM tasks';
      const params: (string | number)[] = [];

      if (request.query.agentId) {
        query += ' WHERE agent_id = ?';
        countQuery += ' WHERE agent_id = ?';
        params.push(request.query.agentId);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const tasks = db.prepare(query).all(...params);
      const countResult = db.prepare(countQuery).get(...(request.query.agentId ? [request.query.agentId] : [])) as { total: number };

      return reply.send({
        success: true,
        data: {
          tasks,
          pagination: {
            page,
            limit,
            total: countResult.total,
            totalPages: Math.ceil(countResult.total / limit),
          },
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

  fastify.post<{
    Body: z.infer<typeof createTaskSchema>;
    Reply: ApiResponse;
  }>('/api/tasks', async (request, reply) => {
    try {
      const parsed = createTaskSchema.parse(request.body);
      const taskId = randomUUID();
      const now = Date.now();

      const insertStmt = db.prepare(`
        INSERT INTO tasks (id, agent_id, input, status, created_at)
        VALUES (?, ?, ?, 'running', ?)
      `);

      insertStmt.run(taskId, parsed.agentId, parsed.input, now);

      broadcast({
        type: 'task:started',
        payload: { taskId, agentId: parsed.agentId },
        timestamp: now,
      });

      reply.code(202).send({
        success: true,
        data: { taskId },
        timestamp: now,
      });

      if (!harnessInstance) {
        updateTask(taskId, 'failed', '', 'Harness not initialized', 0, 0, 0, 0);
        return;
      }

      const task = {
        id: taskId,
        agentId: parsed.agentId,
        input: parsed.input,
        context: parsed.context,
        priority: parsed.priority,
        createdAt: now,
      };

      const registry = new AgentRegistry('./data/agents.json');
      const agentConfig = registry.get(parsed.agentId);

      if (!agentConfig) {
        updateTask(taskId, 'failed', '', 'Agent not found', 0, 0, 0, 0);
        return;
      }

      const result = await harnessInstance.execute(agentConfig, task);

      updateTask(
        taskId,
        result.status,
        result.output,
        result.error,
        result.attempts,
        result.usage.inputTokens,
        result.usage.outputTokens,
        result.durationMs
      );

      if (result.status === 'success') {
        broadcast({
          type: 'task:completed',
          payload: { taskId, output: result.output, usage: result.usage },
          timestamp: Date.now(),
        });
      } else {
        broadcast({
          type: 'task:failed',
          payload: { taskId, error: result.error },
          timestamp: Date.now(),
        });
      }
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
  }>('/api/tasks/:id', async (request, reply) => {
    try {
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(request.params.id);

      if (!task) {
        return reply.code(404).send({
          success: false,
          error: 'Task not found',
          timestamp: Date.now(),
        });
      }

      return reply.send({
        success: true,
        data: task,
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
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/tasks/:id/abort', async (request, reply) => {
    try {
      if (!runnerInstance) {
        return reply.code(500).send({
          success: false,
          error: 'Runner not initialized',
          timestamp: Date.now(),
        });
      }

      const aborted = runnerInstance.abort(request.params.id);

      if (aborted) {
        db.prepare("UPDATE tasks SET status = 'failed', error = 'Aborted by user' WHERE id = ?").run(request.params.id);
      }

      return reply.send({
        success: true,
        data: { aborted },
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

function updateTask(
  taskId: string,
  status: string,
  output: string,
  error: string | undefined,
  attempts: number,
  inputTokens: number,
  outputTokens: number,
  durationMs: number
): void {
  const completedAt = Date.now();

  db.prepare(`
    UPDATE tasks SET status = ?, output = ?, error = ?, attempts = ?, input_tokens = ?, output_tokens = ?, duration_ms = ?, completed_at = ?
    WHERE id = ?
  `).run(status, output, error ?? null, attempts, inputTokens, outputTokens, durationMs, completedAt);

  if (inputTokens > 0 || outputTokens > 0) {
    const task = db.prepare('SELECT agent_id FROM tasks WHERE id = ?').get(taskId) as { agent_id: string } | undefined;
    if (task) {
      db.prepare(`
        INSERT INTO consumption (agent_id, model, input_tokens, output_tokens, provider, task_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(task.agent_id, 'unknown', inputTokens, outputTokens, 'unknown', taskId, completedAt);
    }
  }
}
