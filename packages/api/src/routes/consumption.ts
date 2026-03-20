import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import type { ApiResponse } from '../types.js';

export async function consumptionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Reply: ApiResponse }>('/api/consumption/today', async (_request, reply) => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const timestamp = startOfDay.getTime();

      const stmt = db.prepare(`
        SELECT 
          SUM(input_tokens) as totalInput,
          SUM(output_tokens) as totalOutput,
          COUNT(*) as taskCount
        FROM consumption
        WHERE created_at >= ?
      `);

      const result = stmt.get(timestamp) as {
        totalInput: number | null;
        totalOutput: number | null;
        taskCount: number;
      };

      return reply.send({
        success: true,
        data: {
          inputTokens: result.totalInput ?? 0,
          outputTokens: result.totalOutput ?? 0,
          totalTokens: (result.totalInput ?? 0) + (result.totalOutput ?? 0),
          taskCount: result.taskCount ?? 0,
          date: startOfDay.toISOString().split('T')[0],
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

  fastify.get<{ Reply: ApiResponse }>('/api/consumption/month', async (_request, reply) => {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const timestamp = startOfMonth.getTime();

      const stmt = db.prepare(`
        SELECT 
          SUM(input_tokens) as totalInput,
          SUM(output_tokens) as totalOutput,
          COUNT(*) as taskCount,
          DATE(created_at / 1000, 'unixepoch') as date
        FROM consumption
        WHERE created_at >= ?
        GROUP BY DATE(created_at / 1000, 'unixepoch')
        ORDER BY date DESC
      `);

      const daily = stmt.all(timestamp) as Array<{
        totalInput: number;
        totalOutput: number;
        taskCount: number;
        date: string;
      }>;

      const totals = db.prepare(`
        SELECT 
          SUM(input_tokens) as totalInput,
          SUM(output_tokens) as totalOutput,
          COUNT(*) as taskCount
        FROM consumption
        WHERE created_at >= ?
      `).get(timestamp) as {
        totalInput: number | null;
        totalOutput: number | null;
        taskCount: number;
      };

      return reply.send({
        success: true,
        data: {
          total: {
            inputTokens: totals.totalInput ?? 0,
            outputTokens: totals.totalOutput ?? 0,
            totalTokens: (totals.totalInput ?? 0) + (totals.totalOutput ?? 0),
            taskCount: totals.taskCount ?? 0,
          },
          daily,
          month: startOfMonth.toISOString().split('T')[0],
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

  fastify.get<{ Reply: ApiResponse }>('/api/consumption/summary', async (_request, reply) => {
    try {
      const stmt = db.prepare(`
        SELECT 
          agent_id,
          model,
          provider,
          SUM(input_tokens) as totalInput,
          SUM(output_tokens) as totalOutput,
          COUNT(*) as taskCount
        FROM consumption
        GROUP BY agent_id, model, provider
        ORDER BY totalInput + totalOutput DESC
      `);

      const summary = stmt.all() as Array<{
        agent_id: string;
        model: string;
        provider: string;
        totalInput: number;
        totalOutput: number;
        taskCount: number;
      }>;

      const totals = db.prepare(`
        SELECT 
          SUM(input_tokens) as totalInput,
          SUM(output_tokens) as totalOutput,
          COUNT(*) as taskCount
        FROM consumption
      `).get() as {
        totalInput: number | null;
        totalOutput: number | null;
        taskCount: number;
      };

      return reply.send({
        success: true,
        data: {
          byAgent: summary,
          totals: {
            inputTokens: totals.totalInput ?? 0,
            outputTokens: totals.totalOutput ?? 0,
            totalTokens: (totals.totalInput ?? 0) + (totals.totalOutput ?? 0),
            taskCount: totals.taskCount ?? 0,
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
}
