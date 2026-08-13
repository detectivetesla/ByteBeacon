import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { PasswordValidator } from '../../core/security/password-validator.js';
import { PasswordHasher } from '../../core/security/password-hasher.js';
import { TokenService } from '../../core/security/token.service.js';
import { SessionService } from '../../core/security/session.service.js';
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
  ConflictError,
  NotFoundError,
} from '../../core/errors/app-error.js';
import {
  SecurityDomain,
  UserRole,
  UserStatus,
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
  PhoneVerificationRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ApiResponse,
  AuthResponseData,
  UserSummaryDto,
} from '@bytebeacon/shared';

export interface CustomerAuthRouteDependencies {
  db: pg.Pool;
  hasher: PasswordHasher;
  tokenService: TokenService;
  sessionService: SessionService;
  auditService: AuditService;
  rateLimiter: RateLimiterService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
}

export async function customerAuthRoutes(
  app: FastifyInstance,
  deps: CustomerAuthRouteDependencies,
) {
  const { db, hasher, tokenService, sessionService, auditService, rateLimiter } = deps;
  const authHooks = createAuthHooks(tokenService, deps.apiKeyService, deps.rbacService, db);
  const strictRateLimit = createRateLimitHook(rateLimiter, { limit: 10, windowSeconds: 60 });

  // 1. REGISTER
  app.post<{ Body: RegisterRequest }>(
    '/register',
    { preHandler: [strictRateLimit] },
    async (req: FastifyRequest<{ Body: RegisterRequest }>, reply: FastifyReply) => {
      const { email, phone, password, fullName } = req.body || {};

      if (!email || !phone || !password || !fullName) {
        throw new BadRequestError('Email, phone, password, and fullName are all required');
      }

      const passValidation = PasswordValidator.validate(password);
      if (!passValidation.isValid) {
        throw new BadRequestError('Password does not meet complexity requirements', [
          ...passValidation.errors.map((msg) => ({ field: 'password', code: 'WEAK_PASSWORD', message: msg })),
        ]);
      }

      // Check existing email or phone
      const existing = await db.query<{ id: string; email: string; phone: string }>(
        'SELECT id, email, phone FROM users WHERE LOWER(email) = LOWER($1) OR phone = $2',
        [email.trim(), phone.trim()],
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        if (row.email.toLowerCase() === email.trim().toLowerCase()) {
          throw new ConflictError('An account with this email already exists');
        }
        throw new ConflictError('An account with this phone number already exists');
      }

      const passwordHash = await hasher.hashPassword(password);

      const userRes = await db.query<{
        id: string;
        email: string;
        phone: string;
        fullName: string;
        role: UserRole;
        status: UserStatus;
        securityDomain: SecurityDomain;
        phoneVerified: boolean;
        mfaEnabled: boolean;
        walletBalancePesewas: string;
      }>(
        `INSERT INTO users (email, phone, full_name, password_hash, role, security_domain, status)
         VALUES ($1, $2, $3, $4, 'customer', 'CUSTOMER', 'ACTIVE')
         RETURNING id, email, phone, full_name as "fullName", role, status,
                   security_domain as "securityDomain", phone_verified as "phoneVerified",
                   mfa_enabled as "mfaEnabled", wallet_balance_pesewas as "walletBalancePesewas"`,
        [email.trim().toLowerCase(), phone.trim(), fullName.trim(), passwordHash],
      );

      const user = userRes.rows[0];

      // Generate refresh token and session
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
        domain: user.securityDomain,
        sessionId: session.id,
      });

      await auditService.logEvent({
        correlationId: req.id,
        actorId: user.id,
        actorType: 'CUSTOMER',
        action: 'CUSTOMER_REGISTER',
        resourceType: 'users',
        resourceId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const userSummary: UserSummaryDto = {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        securityDomain: user.securityDomain,
        phoneVerified: user.phoneVerified,
        mfaEnabled: user.mfaEnabled,
        walletBalancePesewas: parseInt(user.walletBalancePesewas, 10) || 0,
      };

      const response: ApiResponse<AuthResponseData> = {
        success: true,
        data: {
          user: userSummary,
          tokens: {
            accessToken,
            refreshToken: rawToken,
            expiresInSeconds: tokenService.getAccessTokenTtl(),
          },
        },
      };

      return reply.status(201).send(response);
    },
  );

  // 2. LOGIN
  app.post<{ Body: LoginRequest }>(
    '/login',
    { preHandler: [strictRateLimit] },
    async (req: FastifyRequest<{ Body: LoginRequest }>, reply: FastifyReply) => {
      const { identifier, password, deviceId } = req.body || {};

      if (!identifier || !password) {
        throw new BadRequestError('Identifier and password are required');
      }

      // Fetch user by email or phone
      const query = `
        SELECT id, email, phone, full_name as "fullName", password_hash as "passwordHash",
               role, status, security_domain as "securityDomain", phone_verified as "phoneVerified",
               mfa_enabled as "mfaEnabled", wallet_balance_pesewas as "walletBalancePesewas",
               failed_login_attempts as "failedLoginAttempts", locked_until as "lockedUntil"
        FROM users
        WHERE LOWER(email) = LOWER($1) OR phone = $1
      `;
      const userRes = await db.query(query, [identifier.trim()]);

      // Constant-time dummy hash verification if user not found to prevent user enumeration timing attacks
      if (userRes.rows.length === 0) {
        await hasher.verifyPassword('$argon2id$v=19$m=65536,t=3,p=4$dummyhashdummyhash$dummyhashdummyhash', password);
        throw new UnauthorizedError('Invalid login credentials');
      }

      const user = userRes.rows[0];

      // Check progressive lockout
      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        const waitSeconds = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 1000);
        throw new ForbiddenError(`Account temporarily locked due to excessive failed attempts. Try again in ${waitSeconds} seconds.`);
      }

      if (user.status === UserStatus.SUSPENDED) {
        throw new ForbiddenError('Your account has been suspended. Please contact support.');
      }

      const isValid = await hasher.verifyPassword(user.passwordHash, password);

      if (!isValid) {
        const attempts = (user.failedLoginAttempts || 0) + 1;
        let lockQuery = 'UPDATE users SET failed_login_attempts = $1 WHERE id = $2';
        let lockParams: unknown[] = [attempts, user.id];

        if (attempts >= 5) {
          const lockMinutes = attempts >= 10 ? 60 : 15;
          const lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
          lockQuery = 'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3';
          lockParams = [attempts, lockedUntil, user.id];
        }

        await db.query(lockQuery, lockParams);

        await auditService.logEvent({
          correlationId: req.id,
          actorId: user.id,
          actorType: 'CUSTOMER',
          action: 'AUTH_LOGIN_FAILED',
          metadata: { attempts },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });

        throw new UnauthorizedError('Invalid login credentials');
      }

      // Reset failed login attempts on successful password
      await db.query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id],
      );

      // Generate refresh token and session
      const { rawToken, tokenHash } = tokenService.generateRefreshToken();
      const session = await sessionService.createSession({
        userId: user.id,
        refreshTokenHash: tokenHash,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        deviceId,
      });

      const accessToken = tokenService.signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        domain: user.securityDomain,
        sessionId: session.id,
      });

      await auditService.logEvent({
        correlationId: req.id,
        actorId: user.id,
        actorType: 'CUSTOMER',
        action: 'CUSTOMER_LOGIN',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const userSummary: UserSummaryDto = {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        securityDomain: user.securityDomain,
        phoneVerified: user.phoneVerified,
        mfaEnabled: user.mfaEnabled,
        walletBalancePesewas: parseInt(user.walletBalancePesewas, 10) || 0,
      };

      const response: ApiResponse<AuthResponseData> = {
        success: true,
        data: {
          user: userSummary,
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

  // 3. REFRESH TOKEN (With Refresh Rotation)
  app.post<{ Body: RefreshTokenRequest }>(
    '/refresh',
    async (req: FastifyRequest<{ Body: RefreshTokenRequest }>, reply: FastifyReply) => {
      const { refreshToken } = req.body || {};

      if (!refreshToken) {
        throw new BadRequestError('Refresh token is required');
      }

      const tokenHash = tokenService.hashToken(refreshToken);
      const session = await sessionService.findByRefreshTokenHash(tokenHash);

      if (!session || session.isRevoked || new Date(session.expiresAt) < new Date()) {
        throw new UnauthorizedError('Invalid or expired refresh token');
      }

      // Check if user is active
      const userRes = await db.query<{
        id: string;
        email: string;
        role: UserRole;
        status: UserStatus;
        securityDomain: SecurityDomain;
      }>('SELECT id, email, role, status, security_domain as "securityDomain" FROM users WHERE id = $1', [session.userId]);

      if (userRes.rows.length === 0 || userRes.rows[0].status === UserStatus.SUSPENDED) {
        throw new ForbiddenError('Account inactive or suspended');
      }

      const user = userRes.rows[0];

      // Rotate Refresh Token
      const { rawToken: newRawToken, tokenHash: newTokenHash } = tokenService.generateRefreshToken();
      await db.query(
        'UPDATE sessions SET refresh_token_hash = $1, last_active_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newTokenHash, session.id],
      );

      const newAccessToken = tokenService.signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        domain: user.securityDomain,
        sessionId: session.id,
      });

      const response: ApiResponse<{ accessToken: string; refreshToken: string; expiresInSeconds: number }> = {
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRawToken,
          expiresInSeconds: tokenService.getAccessTokenTtl(),
        },
      };

      return reply.send(response);
    },
  );

  // 4. LOGOUT (Session Invalidation)
  app.post(
    '/logout',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (req.user?.sessionId) {
        await sessionService.revokeSession(req.user.sessionId);
      }

      await auditService.logEvent({
        correlationId: req.id,
        actorId: req.user?.sub,
        actorType: 'CUSTOMER',
        action: 'CUSTOMER_LOGOUT',
        ipAddress: req.ip,
      });

      return reply.send({ success: true, message: 'Logged out successfully' });
    },
  );

  // 5. GET /me (Current User Profile)
  app.get(
    '/me',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userRes = await db.query<{
        id: string;
        email: string;
        phone: string;
        fullName: string;
        role: UserRole;
        status: UserStatus;
        securityDomain: SecurityDomain;
        phoneVerified: boolean;
        mfaEnabled: boolean;
        walletBalancePesewas: string;
      }>(
        `SELECT id, email, phone, full_name as "fullName", role, status,
                security_domain as "securityDomain", phone_verified as "phoneVerified",
                mfa_enabled as "mfaEnabled", wallet_balance_pesewas as "walletBalancePesewas"
         FROM users WHERE id = $1`,
        [req.user!.sub],
      );

      if (userRes.rows.length === 0) {
        throw new NotFoundError('User profile not found');
      }

      const user = userRes.rows[0];
      const summary: UserSummaryDto = {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        securityDomain: user.securityDomain,
        phoneVerified: user.phoneVerified,
        mfaEnabled: user.mfaEnabled,
        walletBalancePesewas: parseInt(user.walletBalancePesewas, 10) || 0,
      };

      return reply.send({ success: true, data: summary });
    },
  );

  // 6. VERIFY PHONE
  app.post<{ Body: PhoneVerificationRequest }>(
    '/verify-phone',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest<{ Body: PhoneVerificationRequest }>, reply: FastifyReply) => {
      const { code } = req.body || {};

      if (!code) {
        throw new BadRequestError('Verification code is required');
      }

      // Check OTP in phone_verifications
      const codeHash = tokenService.hashToken(code.trim());
      const otpRes = await db.query<{ id: string; expiresAt: Date; attempts: number }>(
        'SELECT id, expires_at as "expiresAt", attempts FROM phone_verifications WHERE user_id = $1 AND otp_hash = $2 AND is_verified = FALSE',
        [req.user!.sub, codeHash],
      );

      if (otpRes.rows.length === 0) {
        throw new BadRequestError('Invalid or expired phone verification code');
      }

      const otp = otpRes.rows[0];
      if (new Date(otp.expiresAt) < new Date()) {
        throw new BadRequestError('Verification code has expired');
      }

      await db.query('UPDATE phone_verifications SET is_verified = TRUE WHERE id = $1', [otp.id]);
      await db.query('UPDATE users SET phone_verified = TRUE WHERE id = $1', [req.user!.sub]);

      await auditService.logEvent({
        correlationId: req.id,
        actorId: req.user!.sub,
        actorType: 'CUSTOMER',
        action: 'PHONE_VERIFIED',
        ipAddress: req.ip,
      });

      return reply.send({ success: true, message: 'Phone number verified successfully' });
    },
  );

  // 7. FORGOT PASSWORD (Single-Use Token)
  app.post<{ Body: ForgotPasswordRequest }>(
    '/forgot-password',
    { preHandler: [strictRateLimit] },
    async (req: FastifyRequest<{ Body: ForgotPasswordRequest }>, reply: FastifyReply) => {
      const { emailOrPhone } = req.body || {};

      if (!emailOrPhone) {
        throw new BadRequestError('Email or phone is required');
      }

      const userRes = await db.query<{ id: string; email: string }>(
        'SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) OR phone = $1',
        [emailOrPhone.trim()],
      );

      // Always return positive response to avoid user enumeration
      if (userRes.rows.length > 0) {
        const user = userRes.rows[0];
        const rawToken = tokenService.generateRefreshToken().rawToken;
        const tokenHash = tokenService.hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await db.query(
          'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
          [user.id, tokenHash, expiresAt],
        );

        await auditService.logEvent({
          correlationId: req.id,
          actorId: user.id,
          actorType: 'CUSTOMER',
          action: 'PASSWORD_RESET_REQUESTED',
          ipAddress: req.ip,
        });
      }

      return reply.send({
        success: true,
        message: 'If the account exists, password reset instructions have been dispatched.',
      });
    },
  );

  // 8. RESET PASSWORD (Revokes all active sessions)
  app.post<{ Body: ResetPasswordRequest }>(
    '/reset-password',
    { preHandler: [strictRateLimit] },
    async (req: FastifyRequest<{ Body: ResetPasswordRequest }>, reply: FastifyReply) => {
      const { token, newPassword } = req.body || {};

      if (!token || !newPassword) {
        throw new BadRequestError('Token and new password are required');
      }

      const passValidation = PasswordValidator.validate(newPassword);
      if (!passValidation.isValid) {
        throw new BadRequestError('Password does not meet complexity requirements', [
          ...passValidation.errors.map((msg) => ({ field: 'newPassword', code: 'WEAK_PASSWORD', message: msg })),
        ]);
      }

      const tokenHash = tokenService.hashToken(token.trim());
      const resetRes = await db.query<{ id: string; userId: string; expiresAt: Date; isUsed: boolean }>(
        'SELECT id, user_id as "userId", expires_at as "expiresAt", is_used as "isUsed" FROM password_resets WHERE token_hash = $1',
        [tokenHash],
      );

      if (resetRes.rows.length === 0 || resetRes.rows[0].isUsed || new Date(resetRes.rows[0].expiresAt) < new Date()) {
        throw new BadRequestError('Invalid or expired password reset token');
      }

      const reset = resetRes.rows[0];
      const newHash = await hasher.hashPassword(newPassword);

      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, reset.userId]);
      await db.query('UPDATE password_resets SET is_used = TRUE WHERE id = $1', [reset.id]);

      // Revoke all existing sessions across devices
      await sessionService.revokeAllUserSessions(reset.userId);

      await auditService.logEvent({
        correlationId: req.id,
        actorId: reset.userId,
        actorType: 'CUSTOMER',
        action: 'PASSWORD_RESET_COMPLETED',
        ipAddress: req.ip,
      });

      return reply.send({
        success: true,
        message: 'Password reset successful. All active sessions have been terminated. Please log in with your new password.',
      });
    },
  );
}
