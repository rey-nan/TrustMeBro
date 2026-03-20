import pino from 'pino';
import type { AgentConfig, AgentTask, AgentResult } from '../agents/index.js';

export type MiddlewarePhase = 'pre-execution' | 'post-execution' | 'pre-completion';

export interface MiddlewareContext {
  agentId: string;
  taskId: string;
  task: AgentTask;
  config: AgentConfig;
  result?: AgentResult;
  phase: MiddlewarePhase;
  metadata: Record<string, unknown>;
}

export interface MiddlewareResult {
  continue: boolean;
  modifiedResult?: AgentResult;
  injectedContext?: string;
  reason?: string;
}

export interface Middleware {
  name: string;
  phase: MiddlewarePhase;
  execute(ctx: MiddlewareContext): Promise<MiddlewareResult>;
}

export class MiddlewarePipeline {
  private middlewares: Middleware[] = [];
  private logger: pino.Logger;

  constructor(logger?: pino.Logger) {
    this.logger = logger ?? pino({ name: 'MiddlewarePipeline' });
  }

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
    this.logger.info({ middleware: middleware.name, phase: middleware.phase }, 'Middleware registered');
  }

  async run(phase: MiddlewarePhase, ctx: MiddlewareContext): Promise<MiddlewareResult> {
    const phaseMiddlewares = this.middlewares.filter((m) => m.phase === phase);
    
    this.logger.info({ phase, middlewareCount: phaseMiddlewares.length }, 'Running middleware pipeline');

    let injectedContexts: string[] = [];
    let shouldContinue = true;
    let reason: string | undefined;

    for (const middleware of phaseMiddlewares) {
      try {
        this.logger.debug({ middleware: middleware.name }, 'Executing middleware');
        
        const result = await middleware.execute({
          ...ctx,
          phase,
        });

        if (result.injectedContext) {
          injectedContexts.push(result.injectedContext);
        }

        if (!result.continue) {
          shouldContinue = false;
          reason = result.reason ?? `Middleware ${middleware.name} returned continue: false`;
          this.logger.info({ middleware: middleware.name, reason }, 'Middleware blocked pipeline');
          break;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error({ middleware: middleware.name, error: message }, 'Middleware error - continuing pipeline');
      }
    }

    return {
      continue: shouldContinue,
      injectedContext: injectedContexts.length > 0 ? injectedContexts.join('\n\n') : undefined,
      reason,
    };
  }

  getMiddlewareCount(): number {
    return this.middlewares.length;
  }

  listMiddlewares(): Array<{ name: string; phase: MiddlewarePhase }> {
    return this.middlewares.map((m) => ({ name: m.name, phase: m.phase }));
  }
}
