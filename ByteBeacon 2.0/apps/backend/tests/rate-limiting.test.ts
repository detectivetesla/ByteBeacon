import { describe, it, expect } from 'vitest';
import { RateLimiterService } from '../src/core/security/rate-limiter.service.js';

describe('Multi-Layer Rate Limiting System', () => {
  it('should allow requests within limit and reject excess requests', async () => {
    const rateLimiter = new RateLimiterService(null); // In-memory engine
    const key = 'test_ip_192.168.1.1';

    // Limit of 3 requests per 10 seconds
    const req1 = await rateLimiter.checkLimit({ key, limit: 3, windowSeconds: 10 });
    expect(req1.allowed).toBe(true);
    expect(req1.remaining).toBe(2);

    const req2 = await rateLimiter.checkLimit({ key, limit: 3, windowSeconds: 10 });
    expect(req2.allowed).toBe(true);
    expect(req2.remaining).toBe(1);

    const req3 = await rateLimiter.checkLimit({ key, limit: 3, windowSeconds: 10 });
    expect(req3.allowed).toBe(true);
    expect(req3.remaining).toBe(0);

    // 4th request should exceed limit
    const req4 = await rateLimiter.checkLimit({ key, limit: 3, windowSeconds: 10 });
    expect(req4.allowed).toBe(false);
    expect(req4.remaining).toBe(0);
    expect(req4.resetSeconds).toBeGreaterThan(0);
  });
});
