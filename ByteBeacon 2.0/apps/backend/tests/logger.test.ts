import { describe, it, expect } from 'vitest';
import { sensitiveKeys } from '../src/core/logging/logger.js';

describe('Logger Redaction', () => {
  it('should include all required sensitive keys in redaction list', () => {
    const requiredKeys = [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'cookie',
      'secret',
      'apiKey',
      'apiSecret',
      'paystackSecret',
      'databaseUrl',
      'connectionString',
    ];

    for (const key of requiredKeys) {
      expect(sensitiveKeys).toContain(key);
      expect(sensitiveKeys).toContain(`*.${key}`);
    }
  });
});
