import { describe, it, expect, vi } from 'vitest';
import { TokenService } from '../src/core/security/token.service.js';
import { SessionService } from '../src/core/security/session.service.js';
import { SecurityDomain, UserRole } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Session System & Token Lifecycle', () => {
  const secret = '0123456789abcdef0123456789abcdef';
  const tokenService = new TokenService(secret, 2); // 2-second short-lived token

  it('should sign and verify access tokens', () => {
    const token = tokenService.signAccessToken({
      sub: 'usr_123',
      email: 'user@example.com',
      role: UserRole.CUSTOMER,
      domain: SecurityDomain.CUSTOMER,
      sessionId: 'sess_abc',
    });

    const decoded = tokenService.verifyAccessToken(token);
    expect(decoded.sub).toBe('usr_123');
    expect(decoded.email).toBe('user@example.com');
    expect(decoded.role).toBe(UserRole.CUSTOMER);
    expect(decoded.domain).toBe(SecurityDomain.CUSTOMER);
    expect(decoded.sessionId).toBe('sess_abc');
  });

  it('should reject tampered token signatures', () => {
    const token = tokenService.signAccessToken({
      sub: 'usr_123',
      email: 'user@example.com',
      role: UserRole.CUSTOMER,
      domain: SecurityDomain.CUSTOMER,
    });

    const parts = token.split('.');
    // Tamper with payload
    const tampered = `${parts[0]}.${Buffer.from(JSON.stringify({ sub: 'usr_hacked' })).toString('base64url')}.${parts[2]}`;

    expect(() => tokenService.verifyAccessToken(tampered)).toThrow();
  });

  it('should reject expired tokens', async () => {
    const expiredService = new TokenService(secret, -10); // Expired 10s ago
    const expiredToken = expiredService.signAccessToken({
      sub: 'usr_expired',
      email: 'user@example.com',
      role: UserRole.CUSTOMER,
      domain: SecurityDomain.CUSTOMER,
    });

    expect(() => tokenService.verifyAccessToken(expiredToken)).toThrow('Token has expired');
  });

  it('should generate cryptographically random refresh tokens and compute SHA-256 hashes', () => {
    const { rawToken, tokenHash } = tokenService.generateRefreshToken();
    expect(rawToken).toHaveLength(80);
    expect(tokenHash).toHaveLength(64);
    expect(tokenService.hashToken(rawToken)).toBe(tokenHash);
  });

  it('should create and revoke sessions in session service', async () => {
    const mockDb = {
      query: vi.fn().mockImplementation((q: string) => {
        if (q.includes('INSERT INTO sessions')) {
          return Promise.resolve({
            rows: [
              {
                id: 'sess_1',
                userId: 'usr_1',
                refreshTokenHash: 'hash_1',
                expiresAt: new Date(Date.now() + 100000),
                isRevoked: false,
                createdAt: new Date(),
                lastActiveAt: new Date(),
              },
            ],
          });
        }
        if (q.includes('SELECT id, user_id')) {
          return Promise.resolve({
            rows: [{ id: 'sess_1', userId: 'usr_1', isRevoked: false, expiresAt: new Date(Date.now() + 100000) }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const sessionService = new SessionService(mockDb, null);

    const session = await sessionService.createSession({
      userId: 'usr_1',
      refreshTokenHash: 'hash_1',
    });

    expect(session.id).toBe('sess_1');

    const validation = await sessionService.validateSession('sess_1');
    expect(validation.valid).toBe(true);
    expect(validation.userId).toBe('usr_1');

    await sessionService.revokeSession('sess_1');
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE sessions SET is_revoked = TRUE'), ['sess_1']);

    await sessionService.revokeAllUserSessions('usr_1');
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE sessions SET is_revoked = TRUE WHERE user_id = $1'), ['usr_1']);
  });
});
