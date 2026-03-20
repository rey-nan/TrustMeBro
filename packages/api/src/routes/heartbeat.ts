import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import pino from 'pino';
import { db } from '../db.js';
import type { ApiResponse } from '../types.js';
import type { HeartbeatSystem, HeartbeatStatus } from '@trustmebro/core';

const logger = pino({ name: 'HeartbeatRoutes' });

let heartbeatSystem: HeartbeatSystem | null = null;

export function setHeartbeatSystem(system: HeartbeatSystem): void {
  heartbeatSystem = system;
}

const registerSchema = z.object({
  agentId: z.string().min(1),
  cronExpression: z.string().min(1),
});

export async function heartbeatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Reply: ApiResponse }>('/api/heartbeat', async (_request, reply) => {
    try {
      if (!heartbeatSystem) {
        return reply.code(500).send({
          success: false,
          error: 'Heartbeat system not initialized',
          timestamp: Date.now(),
        });
      }

      const status = heartbeatSystem.getStatus();
      return reply.send({
        success: true,
        data: status,
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
    Body: z.infer<typeof registerSchema>;
    Reply: ApiResponse;
  }>('/api/heartbeat', async (request, reply) => {
    try {
      if (!heartbeatSystem) {
        return reply.code(500).send({
          success: false,
          error: 'Heartbeat system not initialized',
          timestamp: Date.now(),
        });
      }

      const parsed = registerSchema.parse(request.body);
      const success = heartbeatSystem.register(parsed.agentId, parsed.cronExpression);

      if (success) {
        db.prepare(`
          UPDATE agents SET heartbeat_cron = ? WHERE id = ?
        `).run(parsed.cronExpression, parsed.agentId);

        logger.info({ agentId: parsed.agentId, cron: parsed.cronExpression }, 'Heartbeat registered');
      }

      return reply.send({
        success,
        data: { registered: success },
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

  fastify.delete<{
    Params: { agentId: string };
    Reply: ApiResponse;
  }>('/api/heartbeat/:agentId', async (request, reply) => {
    try {
      if (!heartbeatSystem) {
        return reply.code(500).send({
          success: false,
          error: 'Heartbeat system not initialized',
          timestamp: Date.now(),
        });
      }

      const success = heartbeatSystem.unregister(request.params.agentId);

      if (success) {
        db.prepare(`
          UPDATE agents SET heartbeat_cron = NULL WHERE id = ?
        `).run(request.params.agentId);
      }

      return reply.send({
        success: true,
        data: { unregistered: success },
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
    Params: { agentId: string };
    Reply: ApiResponse;
  }>('/api/heartbeat/:agentId/wake', async (request, reply) => {
    try {
      if (!heartbeatSystem) {
        return reply.code(500).send({
          success: false,
          error: 'Heartbeat system not initialized',
          timestamp: Date.now(),
        });
      }

      const success = heartbeatSystem.wakeNow(request.params.agentId);

      return reply.send({
        success,
        data: { wakeInitiated: success },
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
    Params: { agentId: string };
    Reply: ApiResponse;
  }>('/api/heartbeat/:agentId/status', async (request, reply) => {
    try {
      if (!heartbeatSystem) {
        return reply.code(500).send({
          success: false,
          error: 'Heartbeat system not initialized',
          timestamp: Date.now(),
        });
      }

      const allStatus = heartbeatSystem.getStatus();
      const status = allStatus.find((s) => s.agentId === request.params.agentId);

      if (!status) {
        return reply.code(404).send({
          success: false,
          error: 'Heartbeat not found for agent',
          timestamp: Date.now(),
        });
      }

      const logs = db.prepare(`
        SELECT * FROM heartbeat_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT 10
      `).all(request.params.agentId);

      return reply.send({
        success: true,
        data: { ...status, recentLogs: logs },
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
