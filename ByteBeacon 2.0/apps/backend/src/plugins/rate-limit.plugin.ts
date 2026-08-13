import { FastifyRequest, FastifyReply } from 'fastify';
import { RateLimiterService } from '../core/security/rate-limiter.service.js';
import { RateLimitExceededError } from '../core/errors/app-error.js';

export interface RouteRateLimitConfig {
  limit: number;
  windowSeconds: number;
  keyGenerator?: (req: FastifyRequest) => string;
}

export function createRateLimitHook(
  rateLimiter: RateLimiterService,
  defaultConfig: RouteRateLimitConfig = { limit: 60, windowSeconds: 60 },
) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const clientIp =
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-forwarded-for'] ? (req.headers['x-forwarded-for'] as string).split(',')[0].trim() : req.ip);

    const key = defaultConfig.keyGenerator
      ? defaultConfig.keyGenerator(req)
      : `ip:${clientIp}:${req.method}:${req.routerPath || req.url}`;

    const result = await rateLimiter.checkLimit({
      key,
      limit: defaultConfig.limit,
      windowSeconds: defaultConfig.windowSeconds,
    });

    reply.header('RateLimit-Limit', result.limit);
    reply.header('RateLimit-Remaining', result.remaining);
    reply.header('RateLimit-Reset', result.resetSeconds);

    if (!result.allowed) {
      reply.header('Retry-After', result.resetSeconds);
      throw new RateLimitExceededError(`Rate limit exceeded. Please retry after ${result.resetSeconds} seconds.`);
    }
  };
}
