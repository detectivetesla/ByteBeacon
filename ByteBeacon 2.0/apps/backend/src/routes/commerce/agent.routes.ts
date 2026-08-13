import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { BadRequestError, NotFoundError, ConflictError } from '../../core/errors/app-error.js';
import {
  ApplyAgentRequest,
  AgentProfileDto,
  ApiResponse,
} from '@bytebeacon/shared';

export interface AgentRouteDependencies {
  db: pg.Pool;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
}

export async function agentRoutes(
  app: FastifyInstance,
  deps: AgentRouteDependencies,
) {
  const { db, tokenService, apiKeyService, rbacService } = deps;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // 1. GET AGENT PROFILE
  app.get(
    '/agents/profile',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const query = `
        SELECT id, user_id as "userId", business_name as "businessName",
               slug, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
        FROM agents
        WHERE user_id = $1
      `;

      const result = await db.query(query, [req.user!.sub]);
      if (result.rows.length === 0) {
        throw new NotFoundError('Agent account not found for current user');
      }

      const r = result.rows[0];
      const profile: AgentProfileDto = {
        id: r.id,
        userId: r.userId,
        businessName: r.businessName,
        slug: r.slug,
        isActive: r.isActive,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString(),
      };

      const response: ApiResponse<AgentProfileDto> = {
        success: true,
        data: profile,
      };

      return reply.send(response);
    },
  );

  // 2. APPLY AS AGENT
  app.post<{ Body: ApplyAgentRequest }>(
    '/agents/apply',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest<{ Body: ApplyAgentRequest }>, reply: FastifyReply) => {
      const { businessName, slug } = req.body || {};

      if (!businessName || !slug) {
        throw new BadRequestError('Business name and store slug are required');
      }

      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Check if user already is an agent
      const existingUser = await db.query('SELECT id FROM agents WHERE user_id = $1', [req.user!.sub]);
      if (existingUser.rows.length > 0) {
        throw new ConflictError('You have already applied or have an active agent account');
      }

      // Check slug uniqueness
      const existingSlug = await db.query('SELECT id FROM agents WHERE slug = $1', [cleanSlug]);
      if (existingSlug.rows.length > 0) {
        throw new ConflictError('Storefront slug is already taken. Please choose another.');
      }

      const insertRes = await db.query(
        `INSERT INTO agents (user_id, business_name, slug, is_active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, user_id as "userId", business_name as "businessName",
                   slug, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
        [req.user!.sub, businessName.trim(), cleanSlug],
      );

      // Update user role to agent
      await db.query("UPDATE users SET role = 'agent' WHERE id = $1", [req.user!.sub]);

      const r = insertRes.rows[0];
      const profile: AgentProfileDto = {
        id: r.id,
        userId: r.userId,
        businessName: r.businessName,
        slug: r.slug,
        isActive: r.isActive,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString(),
      };

      const response: ApiResponse<AgentProfileDto> = {
        success: true,
        data: profile,
      };

      return reply.status(201).send(response);
    },
  );
}
