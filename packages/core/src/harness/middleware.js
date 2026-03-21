import pino from 'pino';
export class MiddlewarePipeline {
    middlewares = [];
    logger;
    constructor(logger) {
        this.logger = logger ?? pino({ name: 'MiddlewarePipeline' });
    }
    use(middleware) {
        this.middlewares.push(middleware);
        this.logger.info({ middleware: middleware.name, phase: middleware.phase }, 'Middleware registered');
    }
    async run(phase, ctx) {
        const phaseMiddlewares = this.middlewares.filter((m) => m.phase === phase);
        this.logger.info({ phase, middlewareCount: phaseMiddlewares.length }, 'Running middleware pipeline');
        let injectedContexts = [];
        let shouldContinue = true;
        let reason;
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
            }
            catch (error) {
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
    getMiddlewareCount() {
        return this.middlewares.length;
    }
    listMiddlewares() {
        return this.middlewares.map((m) => ({ name: m.name, phase: m.phase }));
    }
}
//# sourceMappingURL=middleware.js.map