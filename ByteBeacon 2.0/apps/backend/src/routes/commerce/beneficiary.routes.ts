import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { BeneficiaryService } from '../../core/commerce/beneficiary.service.js';
import { TokenService } from '../../core/security/token.service.js';
import { ApiKeyService } from '../../core/security/api-key.service.js';
import { RbacService } from '../../core/security/rbac.service.js';
import { createAuthHooks } from '../../plugins/auth.plugin.js';
import { BadRequestError } from '../../core/errors/app-error.js';
import {
  ValidateBeneficiaryRequest,
  BeneficiaryValidationDto,
  ApiResponse,
  NetworkProvider,
} from '@bytebeacon/shared';

export interface BeneficiaryRouteDependencies {
  db: pg.Pool;
  beneficiaryService: BeneficiaryService;
  tokenService: TokenService;
  apiKeyService: ApiKeyService;
  rbacService: RbacService;
}

export async function beneficiaryRoutes(
  app: FastifyInstance,
  deps: BeneficiaryRouteDependencies,
) {
  const { db, beneficiaryService, tokenService, apiKeyService, rbacService } = deps;
  const authHooks = createAuthHooks(tokenService, apiKeyService, rbacService, db);

  // 1. VALIDATE BENEFICIARY
  app.post<{ Body: ValidateBeneficiaryRequest }>(
    '/beneficiaries/validate',
    { preHandler: [authHooks.authenticateCustomer] },
    async (req: FastifyRequest<{ Body: ValidateBeneficiaryRequest }>, reply: FastifyReply) => {
      const { phoneNumber, network } = req.body || {};

      if (!phoneNumber || !network) {
        throw new BadRequestError('Phone number and network are required');
      }

      const result = await beneficiaryService.validatePhoneNumber(phoneNumber, network);

      const response: ApiResponse<BeneficiaryValidationDto> = {
        success: true,
        data: result,
      };

      return reply.send(response);
    },
  );

  // 2. GET BENEFICIARY STATUS
  app.get<{ Params: { phone: string }; Querystring: { network?: string } }>(
    '/beneficiaries/:phone',
    { preHandler: [authHooks.authenticateCustomer] },
    async (
      req: FastifyRequest<{ Params: { phone: string }; Querystring: { network?: string } }>,
      reply: FastifyReply,
    ) => {
      const network = req.query.network as NetworkProvider | undefined;
      const status = await beneficiaryService.getBeneficiaryStatus(req.params.phone, network);

      const response: ApiResponse<BeneficiaryValidationDto | null> = {
        success: true,
        data: status,
      };

      return reply.send(response);
    },
  );
}
