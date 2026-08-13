import { FastifyRequest, FastifyReply } from 'fastify';
import { TokenService, JwtPayload } from '../core/security/token.service.js';
import { ApiKeyService, ValidatedApiKeyResult } from '../core/security/api-key.service.js';
import { RbacService } from '../core/security/rbac.service.js';
import { SecurityDomain, UserRole, Permission, UserStatus } from '@bytebeacon/shared';
import { UnauthorizedError, ForbiddenError } from '../core/errors/app-error.js';
import type pg from 'pg';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload & { status?: UserStatus };
    apiKey?: ValidatedApiKeyResult;
    correlationId: string;
  }
}

export function createAuthHooks(
  tokenService: TokenService,
  apiKeyService: ApiKeyService,
  rbacService: RbacService,
  db: pg.Pool,
) {
  const authenticateCustomer = async (req: FastifyRequest, _reply: FastifyReply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Customer authorization token missing');
    }

    const token = authHeader.substring(7).trim();
    const payload = tokenService.verifyAccessToken(token);

    // Verify user is active in database
    const userRes = await db.query<{ status: UserStatus; role: UserRole }>(
      'SELECT status, role FROM users WHERE id = $1',
      [payload.sub],
    );

    if (userRes.rows.length === 0) {
      throw new UnauthorizedError('User account not found');
    }

    const user = userRes.rows[0];
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenError('Your account has been suspended. Contact support.');
    }

    req.user = { ...payload, status: user.status };
  };

  const authenticateAdmin = async (req: FastifyRequest, _reply: FastifyReply) => {
    await authenticateCustomer(req, _reply);

    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.SUPER_ADMIN)) {
      throw new ForbiddenError('Administrator privileges required');
    }

    if (req.user.domain !== SecurityDomain.ADMIN) {
      throw new ForbiddenError('Invalid security domain for administrative access');
    }
  };

  const authenticateApiKey = (requiredScope?: Permission) => {
    return async (req: FastifyRequest, _reply: FastifyReply) => {
      let rawKey = req.headers['x-api-key'] as string;

      if (!rawKey && req.headers.authorization?.startsWith('Bearer ak_')) {
        rawKey = req.headers.authorization.substring(7).trim();
      }

      if (!rawKey) {
        throw new UnauthorizedError('API key missing from request headers');
      }

      const validatedKey = await apiKeyService.validateApiKey(rawKey, requiredScope);
      req.apiKey = validatedKey;
    };
  };

  const requirePermission = (permission: Permission) => {
    return async (req: FastifyRequest, _reply: FastifyReply) => {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const hasPerm = await rbacService.hasPermission(req.user.role, permission);
      if (!hasPerm) {
        throw new ForbiddenError(`Insufficient permission: ${permission}`);
      }
    };
  };

  return {
    authenticateCustomer,
    authenticateAdmin,
    authenticateApiKey,
    requirePermission,
  };
}
