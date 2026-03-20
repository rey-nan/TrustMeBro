import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ApiResponse } from '../types.js';
import type { SkillRegistry, ToolExecutor, CustomSkillRegistry } from '@trustmebro/core';

let skillRegistry: SkillRegistry | null = null;
let toolExecutor: ToolExecutor | null = null;
let customSkillRegistry: CustomSkillRegistry | null = null;

export function setSkillRegistry(registry: SkillRegistry): void {
  skillRegistry = registry;
}

export function setToolExecutor(executor: ToolExecutor): void {
  toolExecutor = executor;
}

export function setCustomSkillRegistry(registry: CustomSkillRegistry): void {
  customSkillRegistry = registry;
}

const assignSkillsSchema = z.object({
  skillIds: z.array(z.string()),
});

export async function skillsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/skills', async (_request, reply) => {
    if (!skillRegistry) {
      return reply.code(500).send({
        success: false,
        error: 'SkillRegistry not initialized',
        timestamp: Date.now(),
      });
    }

    const skills = skillRegistry.list();

    return reply.send({
      success: true,
      data: skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        toolCount: skill.tools.length,
        tools: skill.tools.map((tool) => ({
          name: tool.definition.name,
          description: tool.definition.description,
          inputSchema: tool.definition.inputSchema,
        })),
      })),
      timestamp: Date.now(),
    });
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/skills/:id', async (request, reply) => {
    if (!skillRegistry) {
      return reply.code(500).send({
        success: false,
        error: 'SkillRegistry not initialized',
        timestamp: Date.now(),
      });
    }

    const skill = skillRegistry.get(request.params.id);

    if (!skill) {
      return reply.code(404).send({
        success: false,
        error: 'Skill not found',
        timestamp: Date.now(),
      });
    }

    return reply.send({
      success: true,
      data: {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        tools: skill.tools.map((tool) => ({
          name: tool.definition.name,
          description: tool.definition.description,
          inputSchema: tool.definition.inputSchema,
        })),
      },
      timestamp: Date.now(),
    });
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/agents/:id/skills', async (request, reply) => {
    if (!skillRegistry) {
      return reply.code(500).send({
        success: false,
        error: 'SkillRegistry not initialized',
        timestamp: Date.now(),
      });
    }

    const skillIds = skillRegistry.getAgentSkills(request.params.id);
    const skills = skillIds
      .map((id) => skillRegistry!.get(id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined);

    return reply.send({
      success: true,
      data: skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        toolCount: skill.tools.length,
      })),
      timestamp: Date.now(),
    });
  });

  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof assignSkillsSchema>;
    Reply: ApiResponse;
  }>('/api/agents/:id/skills', async (request, reply) => {
    if (!skillRegistry) {
      return reply.code(500).send({
        success: false,
        error: 'SkillRegistry not initialized',
        timestamp: Date.now(),
      });
    }

    try {
      const parsed = assignSkillsSchema.parse(request.body);

      skillRegistry.assignSkills(request.params.id, parsed.skillIds);

      return reply.send({
        success: true,
        data: {
          agentId: request.params.id,
          skillIds: parsed.skillIds,
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

  fastify.delete<{
    Params: { id: string; skillId: string };
    Reply: ApiResponse;
  }>('/api/agents/:id/skills/:skillId', async (request, reply) => {
    if (!skillRegistry) {
      return reply.code(500).send({
        success: false,
        error: 'SkillRegistry not initialized',
        timestamp: Date.now(),
      });
    }

    const currentSkills = skillRegistry.getAgentSkills(request.params.id);
    const updatedSkills = currentSkills.filter((id) => id !== request.params.skillId);

    skillRegistry.assignSkills(request.params.id, updatedSkills);

    return reply.send({
      success: true,
      data: {
        agentId: request.params.id,
        skillIds: updatedSkills,
      },
      timestamp: Date.now(),
    });
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/agents/:id/tools', async (request, reply) => {
    if (!skillRegistry) {
      return reply.code(500).send({
        success: false,
        error: 'SkillRegistry not initialized',
        timestamp: Date.now(),
      });
    }

    const skillIds = skillRegistry.getAgentSkills(request.params.id);
    const tools = skillRegistry.getToolsForAgent(skillIds);

    return reply.send({
      success: true,
      data: tools.map((tool) => ({
        name: tool.definition.name,
        description: tool.definition.description,
        inputSchema: tool.definition.inputSchema,
      })),
      timestamp: Date.now(),
    });
  });

  // Custom Skills Routes
  const createCustomSkillSchema = z.object({
    name: z.string().min(1),
    description: z.string().default(''),
    tools: z.array(z.object({
      name: z.string().min(1),
      description: z.string().default(''),
      inputSchema: z.object({
        properties: z.record(z.object({
          type: z.string(),
          description: z.string(),
        })),
        required: z.array(z.string()),
      }),
      executionType: z.enum(['bash', 'node', 'python', 'http']),
      executionCode: z.string().min(1),
      timeout: z.number().optional(),
    })),
  });

  const testCustomSkillSchema = z.object({
    toolName: z.string().min(1),
    input: z.record(z.unknown()),
  });

  fastify.get('/api/custom-skills', async (_request, reply) => {
    if (!customSkillRegistry) {
      return reply.code(500).send({
        success: false,
        error: 'CustomSkillRegistry not initialized',
        timestamp: Date.now(),
      });
    }

    return reply.send({
      success: true,
      data: customSkillRegistry.list(),
      timestamp: Date.now(),
    });
  });

  fastify.post<{
    Body: z.infer<typeof createCustomSkillSchema>;
    Reply: ApiResponse;
  }>('/api/custom-skills', async (request, reply) => {
    if (!customSkillRegistry || !skillRegistry) {
      return reply.code(500).send({
        success: false,
        error: 'Registries not initialized',
        timestamp: Date.now(),
      });
    }

    try {
      const parsed = createCustomSkillSchema.parse(request.body);
      const skill = customSkillRegistry.create(parsed);

      // Register in skill registry for immediate use
      const customSkill = customSkillRegistry.toSkill(skill.id);
      if (customSkill) {
        skillRegistry.register(customSkill);
      }

      return reply.code(201).send({
        success: true,
        data: skill,
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
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/custom-skills/:id', async (request, reply) => {
    if (!customSkillRegistry) {
      return reply.code(500).send({
        success: false,
        error: 'CustomSkillRegistry not initialized',
        timestamp: Date.now(),
      });
    }

    const skill = customSkillRegistry.get(request.params.id);
    if (!skill) {
      return reply.code(404).send({
        success: false,
        error: 'Custom skill not found',
        timestamp: Date.now(),
      });
    }

    return reply.send({
      success: true,
      data: skill,
      timestamp: Date.now(),
    });
  });

  fastify.put<{
    Params: { id: string };
    Body: z.infer<typeof createCustomSkillSchema>;
    Reply: ApiResponse;
  }>('/api/custom-skills/:id', async (request, reply) => {
    if (!customSkillRegistry || !skillRegistry) {
      return reply.code(500).send({
        success: false,
        error: 'Registries not initialized',
        timestamp: Date.now(),
      });
    }

    try {
      const parsed = createCustomSkillSchema.parse(request.body);
      const skill = customSkillRegistry.update(request.params.id, parsed);

      if (!skill) {
        return reply.code(404).send({
          success: false,
          error: 'Custom skill not found',
          timestamp: Date.now(),
        });
      }

      // Re-register in skill registry
      const customSkill = customSkillRegistry.toSkill(skill.id);
      if (customSkill) {
        skillRegistry.register(customSkill);
      }

      return reply.send({
        success: true,
        data: skill,
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
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });

  fastify.delete<{
    Params: { id: string };
    Reply: ApiResponse;
  }>('/api/custom-skills/:id', async (request, reply) => {
    if (!customSkillRegistry) {
      return reply.code(500).send({
        success: false,
        error: 'CustomSkillRegistry not initialized',
        timestamp: Date.now(),
      });
    }

    const deleted = customSkillRegistry.remove(request.params.id);
    if (!deleted) {
      return reply.code(404).send({
        success: false,
        error: 'Custom skill not found',
        timestamp: Date.now(),
      });
    }

    return reply.send({
      success: true,
      data: { deleted: true },
      timestamp: Date.now(),
    });
  });

  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof testCustomSkillSchema>;
    Reply: ApiResponse;
  }>('/api/custom-skills/:id/test', async (request, reply) => {
    if (!customSkillRegistry) {
      return reply.code(500).send({
        success: false,
        error: 'CustomSkillRegistry not initialized',
        timestamp: Date.now(),
      });
    }

    try {
      const parsed = testCustomSkillSchema.parse(request.body);
      const result = await customSkillRegistry.test(
        request.params.id,
        parsed.toolName,
        parsed.input
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
          error: error.errors.map((e) => e.message).join(', '),
          timestamp: Date.now(),
        });
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ success: false, error: message, timestamp: Date.now() });
    }
  });
}
