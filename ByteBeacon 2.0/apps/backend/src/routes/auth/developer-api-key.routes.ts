import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { TokenService } from '../../core/security/token.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { AuditService } from '../../core/security/audit.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { BadRequestError } from '../../core/errors/app-error.js';
import {
  CreateApiKeyRequest,
  ApiKeyCreatedDto,
  ApiKeySummaryDto,
  ApiResponse,
  Permission,
} from '@bytebeacon/shared';

export interface DeveloperApiKeyRouteDependencies {
  db: pg.Pool;
  apiKeyService: ApiKeyService;
  tokenService: TokenService;
  rbacService: RbacService;
  auditService: AuditService;
}

export async function developerApiKeyRoutes(
  app: FastifyInstance,
  deps: DeveloperApiKeyRouteDependencies,
) {
  const { db, apiKeyService, tokenService, rbacService, auditService } = deps;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // 1. CREATE API KEY
  app.post<{ Body: CreateApiKeyRequest }>(
    '/developer/api-keys',
    {
      preHandler: [
        authHooks.authenticateCustomer,
        authHooks.requirePermission(Permission.API_KEYS_MANAGE),
      ],
    },
    async (req: FastifyRequest<{ Body: CreateApiKeyRequest }>, reply: FastifyReply) => {
      const { name, environment, scopes, expiresInDays } = req.body || {};

      if (!name || !environment || !scopes || !Array.isArray(scopes)) {
        throw new BadRequestError('Name, environment, and scopes array are required');
      }

      const generated = await apiKeyService.generateApiKey({
        agentId: req.user!.sub,
        name: name.trim(),
        environment,
        scopes,
        expiresInDays,
      });

      await auditService.logEvent({
        correlationId: req.id,
        actorId: req.user!.sub,
        actorType: 'AGENT',
        action: 'API_KEY_CREATED',
        resourceType: 'api_keys',
        resourceId: generated.id,
        metadata: { name: generated.name, environment: generated.environment, scopes: generated.scopes },
        ipAddress: req.ip,
      });

      const responseData: ApiKeyCreatedDto = {
        id: generated.id,
        name: generated.name,
        keyPrefix: generated.keyPrefix,
        apiKey: generated.rawApiKey, // Shown once
        environment: generated.environment,
        scopes: generated.scopes,
        createdAt: generated.createdAt.toISOString(),
        expiresAt: generated.expiresAt ? generated.expiresAt.toISOString() : null,
      };

      const response: ApiResponse<ApiKeyCreatedDto> = {
        success: true,
        data: responseData,
      };

      return reply.status(201).send(response);
    },
  );

  // 2. LIST API KEYS
  app.get(
    '/developer/api-keys',
    {
      preHandler: [
        authHooks.authenticateCustomer,
        authHooks.requirePermission(Permission.API_KEYS_MANAGE),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const keys = await apiKeyService.listAgentApiKeys(req.user!.sub);

      const items: ApiKeySummaryDto[] = keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        environment: k.environment,
        scopes: k.scopes,
        status: k.status,
        lastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt).toISOString() : null,
        expiresAt: k.expiresAt ? new Date(k.expiresAt).toISOString() : null,
        createdAt: new Date(k.createdAt).toISOString(),
      }));

      const response: ApiResponse<ApiKeySummaryDto[]> = {
        success: true,
        data: items,
      };

      return reply.send(response);
    },
  );

  // 3. REVOKE API KEY
  app.delete<{ Params: { id: string } }>(
    '/developer/api-keys/:id',
    {
      preHandler: [
        authHooks.authenticateCustomer,
        authHooks.requirePermission(Permission.API_KEYS_MANAGE),
      ],
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = req.params;

      if (!id) {
        throw new BadRequestError('API key ID is required');
      }

      await apiKeyService.revokeApiKey(id, req.user!.sub);

      await auditService.logEvent({
        correlationId: req.id,
        actorId: req.user!.sub,
        actorType: 'AGENT',
        action: 'API_KEY_REVOKED',
        resourceType: 'api_keys',
        resourceId: id,
        ipAddress: req.ip,
      });

      return reply.send({ success: true, message: 'API key revoked successfully' });
    },
  );
}
