import fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type Redis from 'ioredis';
import { Env, getConfig } from './config/env.js';
import { logger } from './core/logging/logger.js';
import { errorHandler } from './core/errors/app-error.js';
import { healthRoutes } from './routes/health.routes.js';
import { getDatabasePool } from './infrastructure/database/pool.js';
import { getRedisClient } from './infrastructure/redis/client.js';
import { PasswordHasher } from './core/security/password-hasher.js';
import { TokenService } from './core/security/token.service.js';
import { SessionService } from './core/security/session.service.js';
import { ApiKeyService } from './core/security/api-key.service.js';
import { RbacService } from './core/security/rbac.service.js';
import { AuditService } from './core/security/audit.service.js';
import { RateLimiterService } from './core/security/rate-limiter.service.js';
import { customerAuthRoutes } from './routes/auth/customer-auth.routes.js';
import { adminAuthRoutes } from './routes/auth/admin-auth.routes.js';
import { developerApiKeyRoutes } from './routes/auth/developer-api-key.routes.js';
import { CatalogService } from './core/commerce/catalog.service.js';
import { IdempotencyService } from './core/commerce/idempotency.service.js';
import { OrderService } from './core/commerce/order.service.js';
import { BeneficiaryService } from './core/commerce/beneficiary.service.js';
import { BulkOrderService } from './core/commerce/bulk-order.service.js';
import { catalogRoutes } from './routes/commerce/catalog.routes.js';
import { orderRoutes } from './routes/commerce/order.routes.js';
import { beneficiaryRoutes } from './routes/commerce/beneficiary.routes.js';
import { bulkOrderRoutes } from './routes/commerce/bulk-order.routes.js';
import { agentRoutes } from './routes/commerce/agent.routes.js';

export interface AppOptions {
  config?: Env;
  dbPool?: pg.Pool;
  redisClient?: Redis | null;
  hasher?: PasswordHasher;
  tokenService?: TokenService;
  sessionService?: SessionService;
  apiKeyService?: ApiKeyService;
  rbacService?: RbacService;
  auditService?: AuditService;
  rateLimiter?: RateLimiterService;
  catalogService?: CatalogService;
  idempotencyService?: IdempotencyService;
  orderService?: OrderService;
  beneficiaryService?: BeneficiaryService;
  bulkOrderService?: BulkOrderService;
}

export function createApp(options: AppOptions = {}): FastifyInstance {
  const config = options.config ?? getConfig();

  const app = fastify({
    loggerInstance: logger,
    genReqId(req) {
      return (req.headers['x-request-id'] as string) || randomUUID();
    },
    bodyLimit: 1048576, // 1MB conservative default payload limit
    disableRequestLogging: false,
  });

  // 1. Security Headers (Helmet)
  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  // 2. Strict CORS Configuration
  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (config.CORS_ORIGINS.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error('CORS origin denied by ByteBeacon security policy'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-api-key', 'idempotency-key'],
    credentials: true,
  });

  // 3. Register Global Error Handler
  app.setErrorHandler(errorHandler);

  // 4. Initialize Core & Security Services
  const dbPool = options.dbPool ?? getDatabasePool();
  let redisClient: Redis | null = null;
  try {
    redisClient = options.redisClient ?? getRedisClient();
  } catch {
    // Redis might be null in tests
  }

  const hasher = options.hasher ?? new PasswordHasher();
  const tokenService = options.tokenService ?? new TokenService(config.JWT_SECRET);
  const sessionService = options.sessionService ?? new SessionService(dbPool, redisClient);
  const apiKeyService = options.apiKeyService ?? new ApiKeyService(dbPool);
  const rbacService = options.rbacService ?? new RbacService(dbPool);
  const auditService = options.auditService ?? new AuditService(dbPool);
  const rateLimiter = options.rateLimiter ?? new RateLimiterService(redisClient);

  const catalogService = options.catalogService ?? new CatalogService(dbPool);
  const idempotencyService =
    options.idempotencyService ?? new IdempotencyService(dbPool, redisClient);
  const orderService =
    options.orderService ?? new OrderService(dbPool, catalogService, idempotencyService);
  const beneficiaryService = options.beneficiaryService ?? new BeneficiaryService(dbPool);
  const bulkOrderService =
    options.bulkOrderService ?? new BulkOrderService(dbPool, catalogService);

  // 5. Register Routes
  app.register(healthRoutes);

  // Customer Auth Routes: /api/v1/auth
  app.register(
    async (authSubApp) => {
      await customerAuthRoutes(authSubApp, {
        db: dbPool,
        hasher,
        tokenService,
        sessionService,
        auditService,
        rateLimiter,
        apiKeyService,
        rbacService,
      });
    },
    { prefix: '/api/v1/auth' },
  );

  // Admin Auth & Developer API Key Routes: /api/v1
  app.register(
    async (adminSubApp) => {
      await adminAuthRoutes(adminSubApp, {
        db: dbPool,
        hasher,
        tokenService,
        sessionService,
        auditService,
        rateLimiter,
        apiKeyService,
        rbacService,
      });
      await developerApiKeyRoutes(adminSubApp, {
        db: dbPool,
        apiKeyService,
        tokenService,
        rbacService,
        auditService,
      });
    },
    { prefix: '/api/v1' },
  );

  // Commerce Routes: /api/v1
  app.register(
    async (commerceSubApp) => {
      await catalogRoutes(commerceSubApp, { catalogService });
      await orderRoutes(commerceSubApp, {
        db: dbPool,
        orderService,
        tokenService,
        apiKeyService,
        rbacService,
        rateLimiter,
      });
      await beneficiaryRoutes(commerceSubApp, {
        db: dbPool,
        beneficiaryService,
        tokenService,
        apiKeyService,
        rbacService,
      });
      await bulkOrderRoutes(commerceSubApp, {
        db: dbPool,
        bulkOrderService,
        tokenService,
        apiKeyService,
        rbacService,
        rateLimiter,
      });
      await agentRoutes(commerceSubApp, {
        db: dbPool,
        tokenService,
        apiKeyService,
        rbacService,
      });
    },
    { prefix: '/api/v1' },
  );

  // 6. 404 Handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
        requestId: request.id,
      },
    });
  });

  return app;
}
