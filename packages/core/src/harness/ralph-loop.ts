import pino from 'pino';

export interface RalphLoopOptions<T> {
  maxRetries?: number;
  retryOn?: string[];
  onRetry?: (attempt: number, error: Error) => void;
}

export class RalphLoop {
  private logger: pino.Logger;

  constructor(logger?: pino.Logger) {
    this.logger = logger ?? pino({ name: 'RalphLoop' });
  }

  async execute<T>(
    fn: () => Promise<T>,
    options: RalphLoopOptions<T> = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? 3;
    const retryOn = options.retryOn ?? ['timeout', 'rate_limit', 'ECONNRESET', 'ETIMEDOUT'];
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const shouldRetry = retryOn.some((pattern) =>
          lastError?.message.toLowerCase().includes(pattern.toLowerCase())
        );

        if (!shouldRetry || attempt >= maxRetries) {
          this.logger.error({
            attempt,
            maxRetries,
            error: lastError.message,
            willNotRetry: !shouldRetry,
          }, 'RalphLoop: execution failed');
          throw lastError;
        }

        const backoffMs = Math.pow(2, attempt - 1) * 1000;

        this.logger.warn({
          attempt,
          maxRetries,
          backoffMs,
          error: lastError.message,
        }, 'RalphLoop: retrying after error');

        if (options.onRetry) {
          options.onRetry(attempt, lastError);
        }

        await this.sleep(backoffMs);
      }
    }

    throw lastError ?? new Error('RalphLoop: unknown error');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
