import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config/env.js';

describe('Configuration Validation', () => {
  it('should load default configuration in development environment', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      PORT: '3000',
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/bytebeacon_test',
      REDIS_URL: 'redis://localhost:6379',
      CORS_ORIGINS: 'http://localhost:5173,http://localhost:3000',
    });

    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(3000);
    expect(config.DATABASE_URL).toBe('postgres://postgres:postgres@localhost:5432/bytebeacon_test');
    expect(config.CORS_ORIGINS).toContain('http://localhost:5173');
    expect(config.ALLOW_MOCK_PROVIDERS).toBe(true);
  });

  it('should fail fast when invalid port is provided', () => {
    expect(() =>
      loadConfig({
        PORT: '999999',
      }),
    ).toThrow(/FATAL: Invalid environment configuration/);
  });

  it('should fail fast when invalid CORS origin URL is provided', () => {
    expect(() =>
      loadConfig({
        CORS_ORIGINS: 'not-a-url',
      }),
    ).toThrow(/FATAL: Invalid environment configuration/);
  });
});
