import { describe, it, expect, vi } from 'vitest';
import { BulkOrderService } from '../src/core/commerce/bulk-order.service.js';
import { CatalogService } from '../src/core/commerce/catalog.service.js';
import { BulkSubmissionStatus, NetworkProvider } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Bulk Order Engine & Batch Chunking', () => {
  it('should create bulk submission and compute total amount across items correctly', async () => {
    let insertedSubmission: Record<string, unknown> = {};
    const insertedItems: Array<Record<string, unknown>> = [];

    const mockClient = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q === 'BEGIN' || q === 'COMMIT') return Promise.resolve({});
        if (q.includes('INSERT INTO bulk_submissions')) {
          insertedSubmission = {
            id: 'sub_999',
            userId: params[0],
            name: params[1],
            totalCount: params[2],
            processedCount: 0,
            successCount: 0,
            failedCount: 0,
            totalAmountPesewas: params[3],
            status: 'PENDING',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          return Promise.resolve({ rows: [insertedSubmission] });
        }
        if (q.includes('INSERT INTO bulk_submission_items')) {
          const item = {
            id: `item_${insertedItems.length + 1}`,
            submissionId: params[0],
            orderId: null,
            recipientPhone: params[1],
            productId: params[2],
            amountPesewas: params[3],
            status: 'CREATED',
            errorMessage: null,
            createdAt: new Date(),
          };
          insertedItems.push(item);
          return Promise.resolve({ rows: [item] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };

    const mockDb = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as pg.Pool;

    const catalogService = {
      getProductById: vi.fn().mockImplementation((id: string) => {
        if (id === 'prod_1') {
          return Promise.resolve({
            id: 'prod_1',
            sku: 'MTN-1GB',
            network: NetworkProvider.MTN,
            name: 'MTN 1GB Bundle',
            basePricePesewas: 1000, // 1000 pesewas (GHS 10.00)
          });
        }
        return Promise.resolve({
          id: 'prod_2',
          sku: 'MTN-2GB',
          network: NetworkProvider.MTN,
          name: 'MTN 2GB Bundle',
          basePricePesewas: 2000, // 2000 pesewas (GHS 20.00)
        });
      }),
    } as unknown as CatalogService;

    const bulkOrderService = new BulkOrderService(mockDb, catalogService);

    const submission = await bulkOrderService.createBulkSubmission(
      {
        name: 'Corporate Monthly Data Dispatch',
        items: [
          { recipientPhone: '0241111111', productId: 'prod_1' },
          { recipientPhone: '0242222222', productId: 'prod_2' },
        ],
      },
      'usr_corp_1',
    );

    expect(submission.id).toBe('sub_999');
    expect(submission.totalCount).toBe(2);
    expect(submission.totalAmountPesewas).toBe(3000); // 1000 + 2000 pesewas
    expect(submission.status).toBe(BulkSubmissionStatus.PENDING);
    expect(submission.items).toHaveLength(2);
    expect(submission.items[0].recipientPhone).toBe('0241111111');
    expect(submission.items[1].recipientPhone).toBe('0242222222');
  });
});
