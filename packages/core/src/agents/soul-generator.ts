import pino from 'pino';
import { LLMClient } from '../llm/index.js';
import type { AgentSOUL } from './types.js';

export interface SOULGeneratorConfig {
  name: string;
  role: string;
  description?: string;
}

export class SOULGenerator {
  private client: LLMClient;
  private logger: pino.Logger;

  constructor(client: LLMClient, logger?: pino.Logger) {
    this.client = client;
    this.logger = logger ?? pino({ name: 'SOULGenerator' });
  }

  async generate(config: SOULGeneratorConfig): Promise<AgentSOUL> {
    const { name, role, description } = config;

    if (!name || !role) {
      throw new Error('Name and role are required to generate SOUL');
    }

    this.logger.info({ name, role }, 'Generating SOUL');

    const prompt = `You are creating a unique SOUL (personality profile) for an AI agent.

Agent Identity:
- Name: ${name}
- Role: ${role}
- Description: ${description || 'No description provided'}

Generate a comprehensive SOUL profile for this agent. The SOUL defines how this AI thinks, communicates, and behaves.

Respond ONLY with valid JSON in this exact format:
{
  "name": "${name}",
  "role": "${role}",
  "personality": "A 2-3 sentence description of the agent's core personality traits and temperament",
  "expertise": ["expertise area 1", "expertise area 2", "expertise area 3"],
  "workStyle": "A description of how this agent approaches tasks and work",
  "values": ["value 1", "value 2", "value 3"],
  "communicationStyle": "How this agent communicates - tone, formality, etc",
  "limitations": ["limitation 1", "limitation 2", "limitation 3"]
}

Make the SOUL unique and memorable. Be creative but realistic.`;

    try {
      const response = await this.client.call({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        maxTokens: 800,
      });

      const soul = this.parseSoul(response.content, name, role);

      this.logger.info({ name, expertise: soul.expertise.length }, 'SOUL generated successfully');

      return soul;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ error: message }, 'Failed to generate SOUL');
      throw new Error(`SOUL generation failed: ${message}`);
    }
  }

  private parseSoul(content: string, fallbackName: string, fallbackRole: string): AgentSOUL {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0] as string) as Partial<AgentSOUL>;
        return {
          name: parsed.name ?? fallbackName,
          role: parsed.role ?? fallbackRole,
          personality: parsed.personality ?? 'Helpful and dedicated.',
          expertise: Array.isArray(parsed.expertise) ? parsed.expertise : ['General assistance'],
          workStyle: parsed.workStyle ?? 'Methodical and thorough.',
          values: Array.isArray(parsed.values) ? parsed.values : ['Accuracy', 'Efficiency'],
          communicationStyle: parsed.communicationStyle ?? 'Clear and professional.',
          limitations: Array.isArray(parsed.limitations) ? parsed.limitations : [],
        };
      }
    } catch {
      // Fall through to default
    }

    return {
      name: fallbackName,
      role: fallbackRole,
      personality: 'Helpful and dedicated.',
      expertise: ['General assistance'],
      workStyle: 'Methodical and thorough.',
      values: ['Accuracy', 'Efficiency'],
      communicationStyle: 'Clear and professional.',
      limitations: [],
    };
  }

  toSystemPrompt(soul: AgentSOUL, extras?: string): string {
    const parts: string[] = [
      `# You are ${soul.name}, ${soul.role}`,
      '',
      '## Your Personality',
      soul.personality,
      '',
      '## Your Expertise',
      ...soul.expertise.map((e) => `- ${e}`),
      '',
      '## How You Work',
      soul.workStyle,
      '',
      '## Your Values',
      ...soul.values.map((v) => `- ${v}`),
      '',
      '## How You Communicate',
      soul.communicationStyle,
      '',
      '## Your Limitations',
      ...soul.limitations.map((l) => `- ${l}`),
    ];

    if (extras) {
      parts.push('', '## Additional Instructions', extras);
    }

    return parts.join('\n');
  }
}
