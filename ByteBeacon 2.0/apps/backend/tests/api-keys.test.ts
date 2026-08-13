import { describe, it, expect, vi } from 'vitest';
import { ApiKeyService } from '../src/core/security/api-key.service.js';
import { ApiKeyEnvironment, ApiKeyStatus, Permission } from '@bytebeacon/shared';
import type pg from 'pg';

describe('API Key System (Agent/Developer Domain)', () => {
  it('should generate ak_live_ key and compute SHA-256 hash', async () => {
    let insertedRow: Record<string, unknown> = {};

    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('INSERT INTO api_keys')) {
          insertedRow = {
            id: 'key_123',
            name: params[1],
            keyPrefix: params[2],
            keyHash: params[3],
            environment: params[4],
            scopes: params[5],
            createdAt: new Date(),
            expiresAt: params[6] || null,
          };
          return Promise.resolve({ rows: [insertedRow] });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const apiKeyService = new ApiKeyService(mockDb);

    const result = await apiKeyService.generateApiKey({
      agentId: 'agt_1',
      name: 'Production Storefront Key',
      environment: ApiKeyEnvironment.LIVE,
      scopes: [Permission.ORDERS_CREATE, Permission.ORDERS_READ],
    });

    expect(result.rawApiKey.startsWith('ak_live_')).toBe(true);
    expect(result.keyPrefix.startsWith('ak_live_')).toBe(true);
    expect(result.scopes).toContain(Permission.ORDERS_CREATE);
    expect(result.scopes).toContain(Permission.ORDERS_READ);
  });

  it('should validate API key credentials and enforce required scope', async () => {
    const rawKey = 'ak_live_abcdef1234567890abcdef1234567890';
    const keyPrefix = rawKey.substring(0, 16);
    const keyHash = new ApiKeyService({} as pg.Pool).hashKey(rawKey);

    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('SELECT id, agent_id')) {
          if (params[0] === keyPrefix) {
            return Promise.resolve({
              rows: [
                {
                  id: 'key_123',
                  agentId: 'agt_1',
                  name: 'Test Key',
                  keyHash,
                  environment: ApiKeyEnvironment.LIVE,
                  scopes: [Permission.ORDERS_READ],
                  rateLimitTier: 'TIER_AGENT',
                  status: ApiKeyStatus.ACTIVE,
                  expiresAt: null,
                },
              ],
            });
          }
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const apiKeyService = new ApiKeyService(mockDb);

    // Valid without scope
    const valid = await apiKeyService.validateApiKey(rawKey);
    expect(valid.id).toBe('key_123');
    expect(valid.agentId).toBe('agt_1');

    // Valid with matching scope
    const validWithScope = await apiKeyService.validateApiKey(rawKey, Permission.ORDERS_READ);
    expect(validWithScope.id).toBe('key_123');

    // Invalid when lacking required scope
    await expect(apiKeyService.validateApiKey(rawKey, Permission.ORDERS_REFUND)).rejects.toThrow(
      'API key lacks required permission scope: orders.refund',
    );
  });
});
