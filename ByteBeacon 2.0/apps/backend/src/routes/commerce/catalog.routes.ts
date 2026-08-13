import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CatalogService } from '../../core/commerce/catalog.service.js';
import { NetworkProvider, ApiResponse, CatalogProductDto } from '@bytebeacon/shared';

export interface CatalogRouteDependencies {
  catalogService: CatalogService;
}

export async function catalogRoutes(
  app: FastifyInstance,
  deps: CatalogRouteDependencies,
) {
  const { catalogService } = deps;

  // 1. LIST CATALOG PRODUCTS
  app.get<{ Querystring: { network?: string } }>(
    '/catalog/products',
    async (req: FastifyRequest<{ Querystring: { network?: string } }>, reply: FastifyReply) => {
      const network = req.query.network as NetworkProvider | undefined;
      const products = await catalogService.listActiveProducts(network);

      const response: ApiResponse<CatalogProductDto[]> = {
        success: true,
        data: products,
      };

      return reply.send(response);
    },
  );

  // 2. GET PRODUCT BY ID
  app.get<{ Params: { id: string } }>(
    '/catalog/products/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const product = await catalogService.getProductById(req.params.id);

      const response: ApiResponse<CatalogProductDto> = {
        success: true,
        data: product,
      };

      return reply.send(response);
    },
  );
}
