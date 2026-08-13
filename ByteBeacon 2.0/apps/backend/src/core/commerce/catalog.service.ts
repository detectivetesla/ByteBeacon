import type pg from 'pg';
import { NetworkProvider, CatalogProductDto } from '@bytebeacon/shared';
import { NotFoundError } from '../errors/app-error.js';

export class CatalogService {
  private readonly db: pg.Pool;

  constructor(db: pg.Pool) {
    this.db = db;
  }

  public async listActiveProducts(network?: NetworkProvider): Promise<CatalogProductDto[]> {
    let query = `
      SELECT id, sku, network, name, data_amount_mb as "dataAmountMb",
             validity_days as "validityDays", base_price_pesewas as "basePricePesewas",
             agent_price_pesewas as "agentPricePesewas", is_active as "isActive",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM catalog_products
      WHERE is_active = TRUE
    `;
    const params: unknown[] = [];

    if (network) {
      query += ' AND network = $1';
      params.push(network);
    }

    query += ' ORDER BY network ASC, data_amount_mb ASC';

    const result = await this.db.query(query, params);

    return result.rows.map((r) => ({
      id: r.id,
      sku: r.sku,
      network: r.network as NetworkProvider,
      name: r.name,
      dataAmountMb: r.dataAmountMb,
      validityDays: r.validityDays,
      basePricePesewas: parseInt(r.basePricePesewas, 10),
      agentPricePesewas: r.agentPricePesewas ? parseInt(r.agentPricePesewas, 10) : null,
      isActive: r.isActive,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    }));
  }

  public async getProductById(productId: string): Promise<CatalogProductDto> {
    const query = `
      SELECT id, sku, network, name, data_amount_mb as "dataAmountMb",
             validity_days as "validityDays", base_price_pesewas as "basePricePesewas",
             agent_price_pesewas as "agentPricePesewas", is_active as "isActive",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM catalog_products
      WHERE id = $1 AND is_active = TRUE
    `;

    const result = await this.db.query(query, [productId]);
    if (result.rows.length === 0) {
      throw new NotFoundError(`Product '${productId}' not found or inactive in catalog`);
    }

    const r = result.rows[0];
    return {
      id: r.id,
      sku: r.sku,
      network: r.network as NetworkProvider,
      name: r.name,
      dataAmountMb: r.dataAmountMb,
      validityDays: r.validityDays,
      basePricePesewas: parseInt(r.basePricePesewas, 10),
      agentPricePesewas: r.agentPricePesewas ? parseInt(r.agentPricePesewas, 10) : null,
      isActive: r.isActive,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    };
  }
}
