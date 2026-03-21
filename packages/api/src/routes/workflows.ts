import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { ApiResponse } from '../types.js';
import { WorkflowRegistry, WorkflowRunStore, WorkflowEngine } from '@trustmebro/core';
import { broadcast } from '../websocket/handler.js';
import { db } from '../db.js';

let workflowRegistry: WorkflowRegistry | null = null;
let workflowRunStore: WorkflowRunStore | null = null;
let workflowEngine: WorkflowEngine | null = null;

export function getWorkflowRegistry(): WorkflowRegistry {
  if (!workflowRegistry) {
    workflowRegistry = new WorkflowRegistry('./data/workflows.json');
  }
  return workflowRegistry;
}

export function getWorkflowRunStore(): WorkflowRunStore {
  if (!workflowRunStore) {
    workflowRunStore = new WorkflowRunStore(db);
  }
  return workflowRunStore;
}

export function setWorkflowEngine(engine: WorkflowEngine): void {
  workflowEngine = engine;
}

export function getWorkflowEngine(): WorkflowEngine | null {
  return workflowEngine;
}

const createWorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  pattern: z.enum(['pipeline', 'fan-out', 'swarm', 'review']),
  steps: z.array(z.object({
    id: z.string().min(1),
    agentId: z.string().min(1),
    input: z.string().min(1),
    dependsOn: z.array(z.string()).optional(),
    condition: z.string().optional(),
    timeoutMs: z.number().optional(),
    maxRetries: z.number().optional(),
    onSuccess: z.string().optional(),
    onFailure: z.string().optional(),
    validateOutput: z.string().optional(),
  })),
  combinePrompt: z.string().optional(),
  reviewAgentId: z.string().optional(),
});

const updateWorkflowSchema = createWorkflowSchema.partial().omit({ steps: true });

const runWorkflowSchema = z.object({
  input: z.string().min(1),
});

export async function workflowsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/workflows', async (_request, reply) => {
    try {
      const workflows = getWorkflowRegistry().list();
      return reply.send({
        success: true,
        data: workflows,
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
    Body: z.infer<typeof createWorkflowSchema>;
    Reply: ApiResponse;
  }>('/api/workflows', async (request, reply) => {
    try {
      const parsed = createWorkflowSchema.parse(request.body);

      const workflow = getWorkflowRegistry().create(parsed as any);

      return reply.code(201).send({
        success: true,
        data: workflow,
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

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/workflows/:id', async (request, reply) => {
    try {
      const workflow = getWorkflowRegistry().get(request.params.id);

      if (!workflow) {
        return reply.code(404).send({
          success: false,
          error: 'Workflow not found',
          timestamp: Date.now(),
        });
      }

      return reply.send({
        success: true,
        data: workflow,
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
    Body: z.infer<typeof updateWorkflowSchema>;
    Reply: ApiResponse;
  }>('/api/workflows/:id', async (request, reply) => {
    try {
      const updated = getWorkflowRegistry().update(request.params.id, request.body);

      if (!updated) {
        return reply.code(404).send({
          success: false,
          error: 'Workflow not found',
          timestamp: Date.now(),
        });
      }

      return reply.send({
        success: true,
        data: updated,
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

  fastify.delete<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/workflows/:id', async (request, reply) => {
    try {
      const deleted = getWorkflowRegistry().remove(request.params.id);

      if (!deleted) {
        return reply.code(404).send({
          success: false,
          error: 'Workflow not found',
          timestamp: Date.now(),
        });
      }

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

  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof runWorkflowSchema>;
    Reply: ApiResponse;
  }>('/api/workflows/:id/run', async (request, reply) => {
    try {
      const workflow = getWorkflowRegistry().get(request.params.id);

      if (!workflow) {
        return reply.code(404).send({
          success: false,
          error: 'Workflow not found',
          timestamp: Date.now(),
        });
      }

      const engine = getWorkflowEngine();
      if (!engine) {
        return reply.code(500).send({
          success: false,
          error: 'Workflow engine not initialized',
          timestamp: Date.now(),
        });
      }

      const runId = randomUUID();

      reply.code(202).send({
        success: true,
        data: { runId },
        timestamp: Date.now(),
      });

      const run = await engine.run(workflow, request.body.input);

      getWorkflowRunStore().save(run);

      broadcast({
        type: 'workflow:completed',
        payload: {
          runId: run.id,
          workflowId: workflow.id,
          status: run.status,
          finalOutput: run.finalOutput,
          error: run.error,
          totalTokens: run.totalTokens,
          durationMs: run.completedAt ? run.completedAt - run.startedAt : 0,
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

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/workflows/:id/runs', async (request, reply) => {
    try {
      const runs = getWorkflowRunStore().listByWorkflow(request.params.id, 20);
      return reply.send({
        success: true,
        data: runs,
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
    Params: { runId: string };
    Reply: ApiResponse;
  }>('/api/workflows/runs/:runId', async (request, reply) => {
    try {
      const run = getWorkflowRunStore().get(request.params.runId);

      if (!run) {
        return reply.code(404).send({
          success: false,
          error: 'Run not found',
          timestamp: Date.now(),
        });
      }

      return reply.send({
        success: true,
        data: run,
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

  fastify.get('/api/workflows/runs/recent', async (request, reply) => {
    try {
      const { limit = '50' } = request.query as { limit?: string };
      const runs = getWorkflowRunStore().listRecent(parseInt(limit, 10));
      return reply.send({
        success: true,
        data: runs,
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
