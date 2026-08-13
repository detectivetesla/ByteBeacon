import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';

describe('Health and Readiness Endpoints', () => {
  it('GET /healthz should return 200 and liveness status', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('GET /readyz should return structured status and dependency checks', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/readyz',
    });

    expect([200, 503]).toContain(response.statusCode);
    const body = JSON.parse(response.body);
    expect(body.checks).toBeDefined();
    expect(body.checks.database).toBeDefined();
    expect(body.checks.redis).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });
});
