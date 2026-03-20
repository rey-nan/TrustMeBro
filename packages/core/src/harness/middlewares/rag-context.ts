import pino from 'pino';
import { KnowledgeBase } from '../../knowledge/knowledge-base.js';
import type { Middleware, MiddlewareContext, MiddlewareResult } from '../middleware.js';

export class RAGContextMiddleware implements Middleware {
  name = 'rag-context';
  phase: 'pre-execution' = 'pre-execution';
  private knowledgeBase: KnowledgeBase;
  private logger: pino.Logger;

  constructor(knowledgeBase: KnowledgeBase, logger?: pino.Logger) {
    this.knowledgeBase = knowledgeBase;
    this.logger = logger ?? pino({ name: 'RAGContextMiddleware' });
  }

  async execute(ctx: MiddlewareContext): Promise<MiddlewareResult> {
    try {
      const agentResults = await this.knowledgeBase.search(ctx.task.input, {
        agentId: ctx.agentId,
        limit: 5,
        minScore: 0.5,
      });

      const globalResults = await this.knowledgeBase.search(ctx.task.input, {
        agentId: 'global',
        limit: 3,
        minScore: 0.5,
      });

      const combinedResults = [...agentResults, ...globalResults];
      combinedResults.sort((a, b) => b.score - a.score);

      const uniqueResults = combinedResults.filter((result, index, self) => {
        return index === self.findIndex((r) => r.entry.id === result.entry.id);
      });

      if (uniqueResults.length === 0) {
        return { continue: true };
      }

      const contextString = this.knowledgeBase.buildContextString(uniqueResults);

      this.logger.info({
        agentId: ctx.agentId,
        taskId: ctx.taskId,
        resultsFound: uniqueResults.length,
        topScore: uniqueResults[0]?.score,
      }, 'RAG context injected');

      return {
        continue: true,
        injectedContext: contextString,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn({ error: message }, 'RAG context injection failed');
      return { continue: true };
    }
  }
}
