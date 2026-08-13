import type pg from 'pg';
import {
  BulkSubmissionStatus,
  OrderStatus,
  CreateBulkSubmissionRequest,
  BulkSubmissionSummaryDto,
  BulkSubmissionDetailsDto,
} from '@bytebeacon/shared';
import { CatalogService } from './catalog.service.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../errors/app-error.js';

export class BulkOrderService {
  private readonly db: pg.Pool;
  private readonly catalogService: CatalogService;

  constructor(db: pg.Pool, catalogService: CatalogService) {
    this.db = db;
    this.catalogService = catalogService;
  }

  public async createBulkSubmission(
    input: CreateBulkSubmissionRequest,
    userId: string,
  ): Promise<BulkSubmissionDetailsDto> {
    if (!input.name || !input.items || !Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestError('Bulk submission name and a non-empty items array are required');
    }

    if (input.items.length > 5000) {
      throw new BadRequestError('Bulk submission exceeds maximum batch limit of 5,000 items per request');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // 1. Resolve each item's product price from server catalog
      let totalAmountPesewas = 0;
      const itemsToInsert: Array<{
        recipientPhone: string;
        productId: string;
        amountPesewas: number;
      }> = [];

      for (const item of input.items) {
        const product = await this.catalogService.getProductById(item.productId);
        const cleanPhone = item.recipientPhone.trim().replace(/\s+/g, '');
        totalAmountPesewas += product.basePricePesewas;

        itemsToInsert.push({
          recipientPhone: cleanPhone,
          productId: product.id,
          amountPesewas: product.basePricePesewas,
        });
      }

      // 2. Insert Bulk Submission
      const subQuery = `
        INSERT INTO bulk_submissions (user_id, name, total_count, total_amount_pesewas, status, idempotency_key)
        VALUES ($1, $2, $3, $4, 'PENDING', $5)
        RETURNING id, user_id as "userId", name, total_count as "totalCount",
                  processed_count as "processedCount", success_count as "successCount",
                  failed_count as "failedCount", total_amount_pesewas as "totalAmountPesewas",
                  status, created_at as "createdAt", updated_at as "updatedAt"
      `;

      const subRes = await client.query(subQuery, [
        userId,
        input.name.trim(),
        itemsToInsert.length,
        totalAmountPesewas,
        input.idempotencyKey || null,
      ]);
      const subRow = subRes.rows[0];

      // 3. Batch Insert Items
      const createdItems: Array<{
        id: string;
        submissionId: string;
        orderId: string | null;
        recipientPhone: string;
        productId: string;
        amountPesewas: number;
        status: OrderStatus;
        errorMessage: string | null;
        createdAt: string;
      }> = [];

      for (const item of itemsToInsert) {
        const itemRes = await client.query(
          `INSERT INTO bulk_submission_items (submission_id, recipient_phone, product_id, amount_pesewas, status)
           VALUES ($1, $2, $3, $4, 'CREATED')
           RETURNING id, submission_id as "submissionId", order_id as "orderId",
                     recipient_phone as "recipientPhone", product_id as "productId",
                     amount_pesewas as "amountPesewas", status, error_message as "errorMessage",
                     created_at as "createdAt"`,
          [subRow.id, item.recipientPhone, item.productId, item.amountPesewas],
        );
        const ir = itemRes.rows[0];
        createdItems.push({
          id: ir.id,
          submissionId: ir.submissionId,
          orderId: ir.orderId,
          recipientPhone: ir.recipientPhone,
          productId: ir.productId,
          amountPesewas: parseInt(ir.amountPesewas, 10),
          status: ir.status as OrderStatus,
          errorMessage: ir.errorMessage,
          createdAt: new Date(ir.createdAt).toISOString(),
        });
      }

      await client.query('COMMIT');

      return {
        id: subRow.id,
        userId: subRow.userId,
        name: subRow.name,
        totalCount: subRow.totalCount,
        processedCount: subRow.processedCount,
        successCount: subRow.successCount,
        failedCount: subRow.failedCount,
        totalAmountPesewas: parseInt(subRow.totalAmountPesewas, 10),
        status: subRow.status as BulkSubmissionStatus,
        items: createdItems,
        createdAt: new Date(subRow.createdAt).toISOString(),
        updatedAt: new Date(subRow.updatedAt).toISOString(),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async getBulkSubmissionById(
    submissionId: string,
    userId: string,
    isAdmin = false,
  ): Promise<BulkSubmissionDetailsDto> {
    const subQuery = `
      SELECT id, user_id as "userId", name, total_count as "totalCount",
             processed_count as "processedCount", success_count as "successCount",
             failed_count as "failedCount", total_amount_pesewas as "totalAmountPesewas",
             status, created_at as "createdAt", updated_at as "updatedAt"
      FROM bulk_submissions
      WHERE id = $1
    `;

    const subRes = await this.db.query(subQuery, [submissionId]);
    if (subRes.rows.length === 0) {
      throw new NotFoundError(`Bulk submission '${submissionId}' not found`);
    }

    const subRow = subRes.rows[0];

    if (!isAdmin && subRow.userId !== userId) {
      throw new ForbiddenError('You are not authorized to view this bulk submission');
    }

    const itemsQuery = `
      SELECT id, submission_id as "submissionId", order_id as "orderId",
             recipient_phone as "recipientPhone", product_id as "productId",
             amount_pesewas as "amountPesewas", status, error_message as "errorMessage",
             created_at as "createdAt"
      FROM bulk_submission_items
      WHERE submission_id = $1
      ORDER BY created_at ASC
    `;
    const itemsRes = await this.db.query(itemsQuery, [submissionId]);

    return {
      id: subRow.id,
      userId: subRow.userId,
      name: subRow.name,
      totalCount: subRow.totalCount,
      processedCount: subRow.processedCount,
      successCount: subRow.successCount,
      failedCount: subRow.failedCount,
      totalAmountPesewas: parseInt(subRow.totalAmountPesewas, 10),
      status: subRow.status as BulkSubmissionStatus,
      items: itemsRes.rows.map((ir) => ({
        id: ir.id,
        submissionId: ir.submissionId,
        orderId: ir.orderId,
        recipientPhone: ir.recipientPhone,
        productId: ir.productId,
        amountPesewas: parseInt(ir.amountPesewas, 10),
        status: ir.status as OrderStatus,
        errorMessage: ir.errorMessage,
        createdAt: new Date(ir.createdAt).toISOString(),
      })),
      createdAt: new Date(subRow.createdAt).toISOString(),
      updatedAt: new Date(subRow.updatedAt).toISOString(),
    };
  }
}
