import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DockerSandbox, type SandboxLanguage, type SandboxResult } from '@trustmebro/core';
import { db } from '../db.js';
import type { ApiResponse } from '../types.js';

let sandbox: DockerSandbox | null = null;

export function getSandbox(): DockerSandbox {
  if (!sandbox) {
    sandbox = new DockerSandbox();
  }
  return sandbox;
}

const executeSchema = z.object({
  language: z.enum(['javascript', 'typescript', 'python', 'bash', 'sh']),
  code: z.string().min(1),
  timeoutMs: z.number().optional(),
  memoryMb: z.number().optional(),
});

const executeFilesSchema = z.object({
  language: z.enum(['javascript', 'typescript', 'python', 'bash', 'sh']),
  code: z.string().min(1),
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
  })).optional(),
  timeoutMs: z.number().optional(),
  memoryMb: z.number().optional(),
});

function logExecution(
  language: string,
  codePreview: string,
  exitCode: number,
  success: boolean,
  timedOut: boolean,
  durationMs: number,
  stdoutPreview: string | null,
  stderrPreview: string | null,
  agentId?: string
): void {
  try {
    db.prepare(`
      INSERT INTO sandbox_executions 
      (agent_id, language, code_preview, exit_code, success, timed_out, duration_ms, stdout_preview, stderr_preview, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      agentId ?? null,
      language,
      codePreview.slice(0, 500),
      exitCode,
      success ? 1 : 0,
      timedOut ? 1 : 0,
      durationMs,
      stdoutPreview?.slice(0, 500) ?? null,
      stderrPreview?.slice(0, 500) ?? null,
      Date.now()
    );
  } catch (error) {
  }
}

export async function sandboxRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{
    Body: { command: string; timeoutMs?: number };
    Reply: ApiResponse;
  }>('/api/sandbox/exec-bash', async (request, reply) => {
    try {
      const { command, timeoutMs = 30000 } = request.body as { command: string; timeoutMs?: number };

      const sb = getSandbox();
      const result = await sb.executeScript('bash', command, timeoutMs);

      return reply.send({
        success: true,
        data: result,
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
  }>('/api/sandbox/:id', async (request, reply) => {
    try {
      const { execSync } = await import('child_process');
      execSync(`docker kill trustmebro-${request.params.id} || true`, { timeout: 5000 });
      return reply.send({
        success: true,
        data: { destroyed: true },
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

  fastify.get('/api/sandbox/status', async (_request, reply) => {
    const sb = getSandbox();
    const status = await sb.checkAvailability();

    return reply.send({
      success: true,
      data: status,
      timestamp: Date.now(),
    });
  });

  fastify.post<{
    Body: z.infer<typeof executeSchema>;
    Reply: ApiResponse;
  }>('/api/sandbox/execute', async (request, reply) => {
    try {
      const parsed = executeSchema.parse(request.body);

      const sb = getSandbox();
      const result = await sb.execute({
        language: parsed.language,
        code: parsed.code,
        timeoutMs: parsed.timeoutMs,
        memoryMb: parsed.memoryMb,
      });

      logExecution(
        parsed.language,
        parsed.code,
        result.exitCode,
        result.success,
        result.timedOut,
        result.durationMs,
        result.stdout,
        result.stderr
      );

      return reply.send({
        success: true,
        data: result,
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
    Body: z.infer<typeof executeFilesSchema>;
    Reply: ApiResponse;
  }>('/api/sandbox/execute-files', async (request, reply) => {
    try {
      const parsed = executeFilesSchema.parse(request.body);

      const sb = getSandbox();
      const result = await sb.execute({
        language: parsed.language,
        code: parsed.code,
        files: parsed.files as { path: string; content: string }[],
        timeoutMs: parsed.timeoutMs,
        memoryMb: parsed.memoryMb,
      });

      logExecution(
        parsed.language,
        parsed.code,
        result.exitCode,
        result.success,
        result.timedOut,
        result.durationMs,
        result.stdout,
        result.stderr
      );

      return reply.send({
        success: true,
        data: result,
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

  fastify.get('/api/sandbox/executions', async (request, reply) => {
    const { limit = '50', offset = '0' } = request.query as { limit?: string; offset?: string };

    const rows = db.prepare(`
      SELECT * FROM sandbox_executions
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(parseInt(limit, 10), parseInt(offset, 10));

    return reply.send({
      success: true,
      data: rows,
      timestamp: Date.now(),
    });
  });
}
