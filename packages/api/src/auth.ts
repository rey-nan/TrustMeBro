import type { FastifyRequest, FastifyReply } from 'fastify';

const PUBLIC_ROUTES = ['/health', '/api/status', '/api/providers', '/api/soul/generate'];

export async function authHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const isPublic = PUBLIC_ROUTES.some(
    (route) =>
      request.url === route ||
      request.url.startsWith('/api/providers/')
  );

  if (isPublic) return;

  const secretKey = process.env.API_SECRET_KEY;

  if (!secretKey) return;

  const providedKey = request.headers['x-api-key'] as string | undefined;

  if (!providedKey || providedKey !== secretKey) {
    reply.code(401).send({
      success: false,
      error: 'Unauthorized: invalid or missing API key',
      timestamp: Date.now(),
    });
  }
}
