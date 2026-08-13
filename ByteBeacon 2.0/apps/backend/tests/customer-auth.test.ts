import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { PasswordHasher } from '../src/core/security/password-hasher.js';
import { TokenService } from '../src/core/security/token.service.js';
import { SessionService } from '../src/core/security/session.service.js';
import { ApiKeyService } from '../src/core/security/api-key.service.js';
import { RbacService } from '../src/core/security/rbac.service.js';
import { AuditService } from '../src/core/security/audit.service.js';
import { RateLimiterService } from '../src/core/security/rate-limiter.service.js';
import { SecurityDomain, UserRole, UserStatus } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Customer Auth & Lifecycle Integration', () => {
  const hasher = new PasswordHasher({ memoryCost: 4096, timeCost: 1, parallelism: 1 });
  const tokenService = new TokenService('0123456789abcdef0123456789abcdef');

  it('should successfully register a customer, enforce password strength, and issue tokens', async () => {
    const mockUsers: Record<string, unknown>[] = [];
    const mockSessions: Record<string, unknown>[] = [];

    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('SELECT id, email, phone FROM users')) {
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('INSERT INTO users')) {
          const user = {
            id: 'usr_new_1',
            email: params[0],
            phone: params[1],
            fullName: params[2],
            passwordHash: params[3],
            role: UserRole.CUSTOMER,
            status: UserStatus.ACTIVE,
            securityDomain: SecurityDomain.CUSTOMER,
            phoneVerified: false,
            mfaEnabled: false,
            walletBalancePesewas: '0',
          };
          mockUsers.push(user);
          return Promise.resolve({ rows: [user] });
        }
        if (q.includes('INSERT INTO sessions')) {
          const session = {
            id: 'sess_new_1',
            userId: params[0],
            refreshTokenHash: params[1],
            expiresAt: params[5],
            isRevoked: false,
            createdAt: new Date(),
            lastActiveAt: new Date(),
          };
          mockSessions.push(session);
          return Promise.resolve({ rows: [session] });
        }
        if (q.includes('INSERT INTO audit_logs')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const sessionService = new SessionService(mockDb, null);
    const apiKeyService = new ApiKeyService(mockDb);
    const rbacService = new RbacService(mockDb);
    const auditService = new AuditService(mockDb);
    const rateLimiter = new RateLimiterService(null);

    const app = createApp({
      dbPool: mockDb,
      hasher,
      tokenService,
      sessionService,
      apiKeyService,
      rbacService,
      auditService,
      rateLimiter,
    });

    // 1. Weak password registration should fail with 400
    const weakRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'user@example.com',
        phone: '0241234567',
        password: 'weak',
        fullName: 'Test Customer',
      },
    });

    expect(weakRes.statusCode).toBe(400);
    const weakBody = JSON.parse(weakRes.body);
    expect(weakBody.success).toBe(false);
    expect(weakBody.error.details.length).toBeGreaterThan(0);

    // 2. Strong password registration should succeed with 201
    const strongRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'user@example.com',
        phone: '0241234567',
        password: 'Str0ngP@ssw0rd2026!',
        fullName: 'Test Customer',
      },
    });

    expect(strongRes.statusCode).toBe(201);
    const strongBody = JSON.parse(strongRes.body);
    expect(strongBody.success).toBe(true);
    expect(strongBody.data.user.email).toBe('user@example.com');
    expect(strongBody.data.tokens.accessToken).toBeDefined();
    expect(strongBody.data.tokens.refreshToken).toBeDefined();
  });
});
