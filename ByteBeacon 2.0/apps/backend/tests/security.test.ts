import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

describe('Security Headers and CORS Restrictions', () => {
  it('should include strict security headers on HTTP responses', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
    });

    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
  });

  it('should allow whitelisted CORS origins', async () => {
    const config = loadConfig({
      CORS_ORIGINS: 'https://app.bytebeacon.com',
    });
    const app = createApp({ config });

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/healthz',
      headers: {
        origin: 'https://app.bytebeacon.com',
        'access-control-request-method': 'GET',
      },
    });

    expect(response.headers['access-control-allow-origin']).toBe('https://app.bytebeacon.com');
  });

  it('should reject unauthorized CORS origins', async () => {
    const config = loadConfig({
      CORS_ORIGINS: 'https://app.bytebeacon.com',
    });
    const app = createApp({ config });

    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: {
        origin: 'https://evil-attacker-site.com',
      },
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
  });
});
