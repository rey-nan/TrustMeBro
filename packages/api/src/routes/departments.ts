import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import type { ApiResponse } from '../types.js';
import { DepartmentRegistry, OrganizationRegistry } from '@trustmebro/core';

const deptRegistry = new DepartmentRegistry('./data/departments.json');
const orgRegistry = new OrganizationRegistry('./data/organization.json');

const createDepartmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  color: z.string().default('#00ff88'),
  leadAgentId: z.string().optional(),
  parentDeptId: z.string().optional(),
});

const updateDepartmentSchema = createDepartmentSchema.partial().omit({ id: true });

const addAgentSchema = z.object({
  agentId: z.string().min(1),
});

const createOrganizationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  ceoAgentId: z.string().optional(),
});

export async function departmentsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Reply: ApiResponse }>('/api/departments', async (_request, reply) => {
    try {
      const departments = deptRegistry.list();
      const departmentsWithAgents = departments.map((dept) => {
        const agentRows = db.prepare('SELECT agent_id FROM agent_departments WHERE department_id = ?').all(dept.id) as Array<{ agent_id: string }>;
        return {
          ...dept,
          agentIds: agentRows.map((r) => r.agent_id),
        };
      });
      return reply.send({
        success: true,
        data: departmentsWithAgents,
        timestamp: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.post<{
    Body: z.infer<typeof createDepartmentSchema>;
    Reply: ApiResponse;
  }>('/api/departments', async (request, reply) => {
    try {
      const parsed = createDepartmentSchema.parse(request.body);
      const dept = deptRegistry.create({
        id: parsed.id,
        name: parsed.name,
        description: parsed.description,
        color: parsed.color,
        leadAgentId: parsed.leadAgentId,
        parentDeptId: parsed.parentDeptId,
        agentIds: [],
      });

      db.prepare(`
        INSERT INTO departments (id, name, description, color, lead_agent_id, parent_dept_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(dept.id, dept.name, dept.description, dept.color, dept.leadAgentId ?? null, dept.parentDeptId ?? null, dept.createdAt);

      return reply.code(201).send({ success: true, data: dept, timestamp: Date.now() });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ success: false, error: error.errors.map((e) => e.message).join(', '), timestamp: Date.now() });
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/departments/:id', async (request, reply) => {
    try {
      const dept = deptRegistry.get(request.params.id);
      if (!dept) {
        return reply.code(404).send({ success: false, error: 'Department not found', timestamp: Date.now() });
      }
      const agentRows = db.prepare('SELECT agent_id FROM agent_departments WHERE department_id = ?').all(dept.id) as Array<{ agent_id: string }>;
      return reply.send({ success: true, data: { ...dept, agentIds: agentRows.map((r) => r.agent_id) }, timestamp: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.put<{
    Params: { id: string };
    Body: z.infer<typeof updateDepartmentSchema>;
    Reply: ApiResponse;
  }>('/api/departments/:id', async (request, reply) => {
    try {
      const parsed = updateDepartmentSchema.parse(request.body);
      const dept = deptRegistry.update(request.params.id, parsed);
      if (!dept) {
        return reply.code(404).send({ success: false, error: 'Department not found', timestamp: Date.now() });
      }
      db.prepare(`
        UPDATE departments SET name = ?, description = ?, color = ?, lead_agent_id = ?, parent_dept_id = ?
        WHERE id = ?
      `).run(dept.name, dept.description, dept.color, dept.leadAgentId ?? null, dept.parentDeptId ?? null, dept.id);
      return reply.send({ success: true, data: dept, timestamp: Date.now() });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ success: false, error: error.errors.map((e) => e.message).join(', '), timestamp: Date.now() });
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.delete<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/departments/:id', async (request, reply) => {
    try {
      const deleted = deptRegistry.remove(request.params.id);
      if (!deleted) {
        return reply.code(404).send({ success: false, error: 'Department not found', timestamp: Date.now() });
      }
      db.prepare('DELETE FROM departments WHERE id = ?').run(request.params.id);
      db.prepare('DELETE FROM agent_departments WHERE department_id = ?').run(request.params.id);
      return reply.send({ success: true, data: { deleted: true }, timestamp: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof addAgentSchema>;
    Reply: ApiResponse;
  }>('/api/departments/:id/agents', async (request, reply) => {
    try {
      const { agentId } = addAgentSchema.parse(request.body);
      deptRegistry.addAgent(request.params.id, agentId);
      db.prepare('INSERT OR IGNORE INTO agent_departments (agent_id, department_id) VALUES (?, ?)').run(agentId, request.params.id);
      db.prepare('UPDATE agents SET department_id = ? WHERE id = ?').run(request.params.id, agentId);
      return reply.send({ success: true, data: { added: true }, timestamp: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.delete<{
    Params: { id: string; agentId: string };
    Reply: ApiResponse;
  }>('/api/departments/:id/agents/:agentId', async (request, reply) => {
    try {
      deptRegistry.removeAgent(request.params.id, request.params.agentId);
      db.prepare('DELETE FROM agent_departments WHERE agent_id = ? AND department_id = ?').run(request.params.agentId, request.params.id);
      db.prepare('UPDATE agents SET department_id = NULL WHERE id = ?').run(request.params.agentId);
      return reply.send({ success: true, data: { removed: true }, timestamp: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.get<{ Reply: ApiResponse }>('/api/organization', async (_request, reply) => {
    try {
      const org = orgRegistry.get();
      return reply.send({ success: true, data: org, timestamp: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.post<{
    Body: z.infer<typeof createOrganizationSchema>;
    Reply: ApiResponse;
  }>('/api/organization', async (request, reply) => {
    try {
      const parsed = createOrganizationSchema.parse(request.body);
      const org = orgRegistry.create({
        id: parsed.id,
        name: parsed.name,
        description: parsed.description,
        ceoAgentId: parsed.ceoAgentId,
      });
      return reply.code(201).send({ success: true, data: org, timestamp: Date.now() });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ success: false, error: error.errors.map((e) => e.message).join(', '), timestamp: Date.now() });
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.post<{
    Body: { name: string; role: string; description?: string };
    Reply: ApiResponse;
  }>('/api/soul/generate', async (request, reply) => {
    try {
      const { name, role, description } = request.body as { name: string; role: string; description?: string };

      if (!name || !role) {
        return reply.code(400).send({ success: false, error: 'Name and role are required', timestamp: Date.now() });
      }

      const { LLMClient, SOULGenerator } = await import('@trustmebro/core');
      const client = new LLMClient();
      const generator = new SOULGenerator(client);

      const soul = await generator.generate({ name, role, description });
      const systemPrompt = generator.toSystemPrompt(soul);

      return reply.send({
        success: true,
        data: { soul, systemPrompt },
        timestamp: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });
}
