import type Redis from 'ioredis';

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export class RateLimiterService {
  private readonly redis: Redis | null;
  private readonly memoryStore = new Map<string, { count: number; resetAt: number }>();

  constructor(redis: Redis | null = null) {
    this.redis = redis;
  }

  public async checkLimit(options: RateLimitOptions): Promise<RateLimitResult> {
    const { key, limit, windowSeconds } = options;

    if (this.redis) {
      const now = Math.floor(Date.now() / 1000);
      const windowKey = `rl:${key}:${Math.floor(now / windowSeconds)}`;

      const results = await this.redis
        .multi()
        .incr(windowKey)
        .ttl(windowKey)
        .exec();

      if (!results) {
        return { allowed: true, currentCount: 1, limit, remaining: limit - 1, resetSeconds: windowSeconds };
      }

      const count = (results[0][1] as number) || 1;
      let ttl = results[1][1] as number;

      if (ttl === -1 || count === 1) {
        await this.redis.expire(windowKey, windowSeconds);
        ttl = windowSeconds;
      }

      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);

      return {
        allowed,
        currentCount: count,
        limit,
        remaining,
        resetSeconds: Math.max(1, ttl),
      };
    }

    // In-memory fallback
    const nowMs = Date.now();
    const entry = this.memoryStore.get(key);

    if (!entry || entry.resetAt <= nowMs) {
      this.memoryStore.set(key, { count: 1, resetAt: nowMs + windowSeconds * 1000 });
      return {
        allowed: true,
        currentCount: 1,
        limit,
        remaining: limit - 1,
        resetSeconds: windowSeconds,
      };
    }

    entry.count += 1;
    const allowed = entry.count <= limit;
    const remaining = Math.max(0, limit - entry.count);
    const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - nowMs) / 1000));

    return {
      allowed,
      currentCount: entry.count,
      limit,
      remaining,
      resetSeconds,
    };
  }
}
