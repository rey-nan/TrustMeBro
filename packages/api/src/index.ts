import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..', '..', '..');
config({ path: resolve(rootDir, '.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import pino from 'pino';
import {
  LLMClient,
  AgentRegistry,
  ContextManager,
  AgentRunner,
  Harness,
  HeartbeatSystem,
  AgentWorkspace,
  AgentCommunication,
  EmbeddingService,
  KnowledgeBase,
  SkillRegistry,
  ToolExecutor,
  webSearchSkill,
  httpRequestSkill,
  WorkflowEngine,
} from '@trustmebro/core';
import { db } from './db.js';
import { authHook } from './auth.js';
import { agentsRoutes } from './routes/agents.js';
import { tasksRoutes, setHarnessInstance, setRunnerInstance } from './routes/tasks.js';
import { consumptionRoutes } from './routes/consumption.js';
import { statusRoutes, setLlmClient } from './routes/status.js';
import { departmentsRoutes } from './routes/departments.js';
import { heartbeatRoutes, setHeartbeatSystem } from './routes/heartbeat.js';
import { communicationRoutes, setCommunication } from './routes/communication.js';
import { knowledgeRoutes, setKnowledgeBase } from './routes/knowledge.js';
import { skillsRoutes, setSkillRegistry, setToolExecutor } from './routes/skills.js';
import { sandboxRoutes } from './routes/sandbox.js';
import { workflowsRoutes, setWorkflowEngine } from './routes/workflows.js';
import { handleConnection, broadcast } from './websocket/handler.js';

const logger = pino({ name: 'TrustMeBro API' });

async function main() {
  const fastify = Fastify({
    logger: true,
  });

  const host = process.env.HOST || '0.0.0.0';
  const port = parseInt(process.env.PORT || '3000', 10);
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');

  await fastify.register(cors, {
    origin: allowedOrigins,
    credentials: true,
  });

  await fastify.register(websocket);

  const llmClient = new LLMClient(logger);
  const agentRegistry = new AgentRegistry('./data/agents.json');
  const contextManager = new ContextManager(50, logger);
  const agentRunner = new AgentRunner(llmClient, contextManager, logger);

  const skillRegistry = new SkillRegistry('./data/agent-skills.json', logger);
  const toolExecutor = new ToolExecutor(skillRegistry, logger);

  skillRegistry.register(webSearchSkill);
  skillRegistry.register(httpRequestSkill);
  skillRegistry.register({
    id: 'file_system_default',
    name: 'File System (Default)',
    description: 'Basic file operations in workspace',
    tools: [
      {
        definition: {
          name: 'list_files',
          description: 'List files in workspace',
          inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path' } }, required: [] },
        },
        execute: async () => ({ success: true, result: [] }),
      },
    ],
  });

  await skillRegistry.initializeSkills();

  agentRunner.setToolExecutor(toolExecutor);

  const communication = new AgentCommunication(agentRegistry, './data/comms', (msg) => broadcast(msg), logger);
  agentRunner.setCommunication(communication);

  const harness = new Harness(
    llmClient,
    agentRunner,
    {
      maxRetries: 3,
      maxLoops: 5,
      maxExecutionTimeMs: 60000,
      verificationThreshold: 60,
      loopDetectionWindow: 300000,
    },
    logger
  );

  const heartbeatSystem = new HeartbeatSystem(
    agentRegistry,
    harness,
    (agentId: string) => new AgentWorkspace(agentId),
    (msg) => broadcast(msg),
    logger
  );
  heartbeatSystem.setCommunication(communication);

  const embeddingService = new EmbeddingService(llmClient, logger);
  const knowledgeBase = new KnowledgeBase(embeddingService, './data/knowledge.db', logger);

  harness.setKnowledgeBase(knowledgeBase);

  const workflowEngine = new WorkflowEngine(
    harness,
    agentRegistry,
    communication,
    knowledgeBase,
    (event) => broadcast(event)
  );
  setWorkflowEngine(workflowEngine);

  setHarnessInstance(harness);
  setRunnerInstance(agentRunner);
  setLlmClient(llmClient);
  setHeartbeatSystem(heartbeatSystem);
  setCommunication(communication);
  setKnowledgeBase(knowledgeBase);
  setSkillRegistry(skillRegistry);
  setToolExecutor(toolExecutor);

  fastify.addHook('preHandler', authHook);

  fastify.get('/health', async () => ({ ok: true }));

  await fastify.register(agentsRoutes);
  await fastify.register(tasksRoutes);
  await fastify.register(consumptionRoutes);
  await fastify.register(statusRoutes);
  await fastify.register(departmentsRoutes);
  await fastify.register(heartbeatRoutes);
  await fastify.register(communicationRoutes);
  await fastify.register(knowledgeRoutes);
  await fastify.register(skillsRoutes);
  await fastify.register(sandboxRoutes);
  await fastify.register(workflowsRoutes);

  fastify.get('/ws', { websocket: true }, (connection) => {
    handleConnection(connection.socket);
  });

  heartbeatSystem.start();

  const provider = llmClient.getCurrentProvider();
  const isAvailable = await llmClient.isAvailable();

  try {
    await fastify.listen({ port, host });
    logger.info({
      url: `http://${host}:${port}`,
      provider,
      providerAvailable: isAvailable,
      websocket: `ws://${host}:${port}/ws`,
    }, 'TrustMeBro API started');
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }

  const shutdown = async () => {
    logger.info('Shutting down...');
    heartbeatSystem.stop();
    communication.close();
    knowledgeBase.close();
    await skillRegistry.teardownSkills();
    await fastify.close();
    db.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
