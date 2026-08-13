import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { BulkOrderService } from '../../core/commerce/bulk-order.service.js';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { RateLimiterService } from '../../core/security/rate-limiter.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { createRateLimitHook } from '../../plugins/rate-limit.plugin.js';
import {
  CreateBulkSubmissionRequest,
  BulkSubmissionDetailsDto,
  ApiResponse,
  Permission,
  UserRole,
} from '@bytebeacon/shared';

export interface BulkOrderRouteDependencies {
  db: pg.Pool;
  bulkOrderService: BulkOrderService;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
  rateLimiter: RateLimiterService;
}

export async function bulkOrderRoutes(
  app: FastifyInstance,
  deps: BulkOrderRouteDependencies,
) {
  const { db, bulkOrderService, tokenService, apiKeyService, rbacService, rateLimiter } = deps;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);
  const bulkRateLimit = createRateLimitHook(rateLimiter, { limit: 10, windowSeconds: 60 });

  // 1. CREATE BULK SUBMISSION
  app.post<{ Body: CreateBulkSubmissionRequest }>(
    '/bulk-orders',
    {
      preHandler: [
        bulkRateLimit,
        authHooks.authenticateCustomer,
        authHooks.requirePermission(Permission.ORDERS_CREATE),
      ],
    },
    async (req: FastifyRequest<{ Body: CreateBulkSubmissionRequest }>, reply: FastifyReply) => {
      const idempotencyKey =
        (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;

      const submission = await bulkOrderService.createBulkSubmission(
        {
          ...req.body,
          idempotencyKey,
        },
        req.user!.sub,
      );

      const response: ApiResponse<BulkSubmissionDetailsDto> = {
        success: true,
        data: submission,
      };

      return reply.status(202).send(response);
    },
  );

  // 2. GET BULK SUBMISSION BY ID
  app.get<{ Params: { id: string } }>(
    '/bulk-orders/:id',
    {
      preHandler: [
        authHooks.authenticateCustomer,
        authHooks.requirePermission(Permission.ORDERS_READ),
      ],
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const isAdmin =
        req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN;

      const submission = await bulkOrderService.getBulkSubmissionById(
        req.params.id,
        req.user!.sub,
        isAdmin,
      );

      const response: ApiResponse<BulkSubmissionDetailsDto> = {
        success: true,
        data: submission,
      };

      return reply.send(response);
    },
  );
}
