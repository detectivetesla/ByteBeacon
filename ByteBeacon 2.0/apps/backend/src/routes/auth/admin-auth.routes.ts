import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { PasswordHasher } from '../../core/security/password-hasher.js';
import { TokenService } from '../../core/security/token.service.js';
import { SessionService } from '../../core/security/session.service.js';
import { MfaService } from '../../core/security/mfa.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { RateLimiterService } from '../../core/security/rate-limiter.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { createRateLimitHook } from '../../plugins/rate-limit.plugin.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
} from '../../core/errors/app-error.js';
import {
  SecurityDomain,
  UserRole,
  UserStatus,
  AdminLoginRequest,
  AdminMfaVerifyRequest,
  ApiResponse,
  AuthResponseData,
  MfaSetupData,
  AdminMfaChallengeData,
} from '@bytebeacon/shared';

export interface AdminAuthRouteDependencies {
  db: pg.Pool;
  hasher: PasswordHasher;
  tokenService: TokenService;
  sessionService: SessionService;
  auditService: AuditService;
  rateLimiter: RateLimiterService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
}

export async function adminAuthRoutes(
  app: FastifyInstance,
  deps: AdminAuthRouteDependencies,
) {
  const { db, hasher, tokenService, sessionService, auditService, rateLimiter } = deps;
  const authHooks = createAuthHooks(tokenService, deps.apiKeyService, deps.rbacService, db);
  const strictRateLimit = createRateLimitHook(rateLimiter, { limit: 5, windowSeconds: 60 });

  // 1. ADMIN LOGIN
  app.post<{ Body: AdminLoginRequest }>(
    '/admin/auth/login',
    { preHandler: [strictRateLimit] },
    async (req: FastifyRequest<{ Body: AdminLoginRequest }>, reply: FastifyReply) => {
      const { email, password } = req.body || {};

      if (!email || !password) {
        throw new BadRequestError('Admin email and password are required');
      }

      const query = `
        SELECT id, email, phone, full_name as "fullName", password_hash as "passwordHash",
               role, status, security_domain as "securityDomain",
               mfa_secret as "mfaSecret", mfa_enabled as "mfaEnabled",
               wallet_balance_pesewas as "walletBalancePesewas",
               locked_until as "lockedUntil"
        FROM users
        WHERE LOWER(email) = LOWER($1) AND (role = 'admin' OR role = 'super_admin')
      `;

      const userRes = await db.query(query, [email.trim()]);

      if (userRes.rows.length === 0) {
        await hasher.verifyPassword('$argon2id$v=19$m=65536,t=3,p=4$dummyhashdummyhash$dummyhashdummyhash', password);
        throw new UnauthorizedError('Invalid administrator credentials');
      }

      const user = userRes.rows[0];

      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        throw new ForbiddenError('Admin account temporarily locked due to excessive failed attempts.');
      }

      if (user.status === UserStatus.SUSPENDED) {
        throw new ForbiddenError('Administrator account has been suspended.');
      }

      const isValid = await hasher.verifyPassword(user.passwordHash, password);
      if (!isValid) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: user.id,
          actorType: 'ADMIN',
          action: 'ADMIN_LOGIN_FAILED',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
        throw new UnauthorizedError('Invalid administrator credentials');
      }

      // If MFA is enabled, return MFA challenge session token
      if (user.mfaEnabled && user.mfaSecret) {
        const mfaSessionToken = tokenService.signAccessToken({
          sub: user.id,
          email: user.email,
          role: user.role,
          domain: SecurityDomain.ADMIN,
        });

        const challengeResponse: ApiResponse<AdminMfaChallengeData> = {
          success: true,
          data: {
            mfaRequired: true,
            mfaSessionToken,
          },
        };

        return reply.send(challengeResponse);
      }

      // If MFA not yet set up, issue admin session
      const { rawToken, tokenHash } = tokenService.generateRefreshToken();
      const session = await sessionService.createSession({
        userId: user.id,
        refreshTokenHash: tokenHash,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      const accessToken = tokenService.signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        domain: SecurityDomain.ADMIN,
        sessionId: session.id,
      });

      await auditService.logEvent({
        correlationId: req.id,
        actorId: user.id,
        actorType: 'ADMIN',
        action: 'ADMIN_LOGIN_SUCCESS',
        ipAddress: req.ip,
      });

      const response: ApiResponse<AuthResponseData> = {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            fullName: user.fullName,
            role: user.role,
            status: user.status,
            securityDomain: SecurityDomain.ADMIN,
            phoneVerified: true,
            mfaEnabled: user.mfaEnabled,
            walletBalancePesewas: parseInt(user.walletBalancePesewas, 10) || 0,
          },
          tokens: {
            accessToken,
            refreshToken: rawToken,
            expiresInSeconds: tokenService.getAccessTokenTtl(),
          },
        },
      };

      return reply.send(response);
    },
  );

  // 2. ADMIN MFA SETUP
  app.post(
    '/admin/auth/mfa/setup',
    { preHandler: [authHooks.authenticateAdmin] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const secret = MfaService.generateSecret();
      const qrUri = MfaService.generateOtpAuthUri(req.user!.email, 'ByteBeacon Admin', secret);
      const { rawCodes, hashedCodes } = MfaService.generateRecoveryCodes();

      // Store unconfirmed MFA secret in database
      await db.query('UPDATE users SET mfa_secret = $1 WHERE id = $2', [secret, req.user!.sub]);

      await auditService.logEvent({
        correlationId: req.id,
        actorId: req.user!.sub,
        actorType: 'ADMIN',
        action: 'ADMIN_MFA_SETUP_INITIATED',
        ipAddress: req.ip,
      });

      const response: ApiResponse<MfaSetupData> = {
        success: true,
        data: {
          secret,
          qrUri,
          recoveryCodes: rawCodes,
        },
      };

      return reply.send(response);
    },
  );

  // 3. ADMIN MFA VERIFY & CHALLENGE RESOLUTION
  app.post<{ Body: AdminMfaVerifyRequest }>(
    '/admin/auth/mfa/verify',
    { preHandler: [strictRateLimit] },
    async (req: FastifyRequest<{ Body: AdminMfaVerifyRequest }>, reply: FastifyReply) => {
      const { mfaSessionToken, totpCode } = req.body || {};

      if (!mfaSessionToken || !totpCode) {
        throw new BadRequestError('MFA session token and TOTP code are required');
      }

      const payload = tokenService.verifyAccessToken(mfaSessionToken);

      const userRes = await db.query<{
        id: string;
        email: string;
        phone: string;
        fullName: string;
        role: UserRole;
        status: UserStatus;
        mfaSecret: string;
        mfaEnabled: boolean;
        walletBalancePesewas: string;
      }>(
        'SELECT id, email, phone, full_name as "fullName", role, status, mfa_secret as "mfaSecret", mfa_enabled as "mfaEnabled", wallet_balance_pesewas as "walletBalancePesewas" FROM users WHERE id = $1',
        [payload.sub],
      );

      if (userRes.rows.length === 0 || !userRes.rows[0].mfaSecret) {
        throw new UnauthorizedError('MFA not configured or user not found');
      }

      const user = userRes.rows[0];
      const isValid = MfaService.verifyCode(user.mfaSecret, totpCode.trim());

      if (!isValid) {
        await auditService.logEvent({
          correlationId: req.id,
          actorId: user.id,
          actorType: 'ADMIN',
          action: 'ADMIN_MFA_FAILED',
          ipAddress: req.ip,
        });
        throw new UnauthorizedError('Invalid TOTP verification code');
      }

      // Mark MFA enabled if not already
      if (!user.mfaEnabled) {
        await db.query('UPDATE users SET mfa_enabled = TRUE WHERE id = $1', [user.id]);
      }

      const { rawToken, tokenHash } = tokenService.generateRefreshToken();
      const session = await sessionService.createSession({
        userId: user.id,
        refreshTokenHash: tokenHash,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      const accessToken = tokenService.signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        domain: SecurityDomain.ADMIN,
        sessionId: session.id,
      });

      await auditService.logEvent({
        correlationId: req.id,
        actorId: user.id,
        actorType: 'ADMIN',
        action: 'ADMIN_MFA_SUCCESS',
        ipAddress: req.ip,
      });

      const response: ApiResponse<AuthResponseData> = {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            fullName: user.fullName,
            role: user.role,
            status: user.status,
            securityDomain: SecurityDomain.ADMIN,
            phoneVerified: true,
            mfaEnabled: true,
            walletBalancePesewas: parseInt(user.walletBalancePesewas, 10) || 0,
          },
          tokens: {
            accessToken,
            refreshToken: rawToken,
            expiresInSeconds: tokenService.getAccessTokenTtl(),
          },
        },
      };

      return reply.send(response);
    },
  );
}
