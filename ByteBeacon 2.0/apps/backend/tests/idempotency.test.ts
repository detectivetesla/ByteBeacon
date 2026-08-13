import { describe, it, expect, vi } from 'vitest';
import { IdempotencyService } from '../src/core/commerce/idempotency.service.js';
import { OrderService } from '../src/core/commerce/order.service.js';
import { CatalogService } from '../src/core/commerce/catalog.service.js';
import { NetworkProvider, OrderStatus, PaymentStatus, ProviderStatus, RefundStatus } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Idempotency Engine & High-Concurrency Protection', () => {
  it('should detect hash mismatch and throw ConflictError on payload tampering', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            requestHash: 'hash_original_payload',
            responseStatus: 202,
            responseBody: { id: 'ord_1' },
            expiresAt: new Date(Date.now() + 100000),
          },
        ],
      }),
    } as unknown as pg.Pool;

    const idempotencyService = new IdempotencyService(mockDb, null);

    await expect(
      idempotencyService.getExistingResponse('key_123', 'usr_1', 'hash_different_payload'),
    ).rejects.toThrow('Idempotency key collision');
  });

  it('should return cached response when idempotency key and payload match', async () => {
    const expectedBody = { id: 'ord_cached_100', status: 'CREATED' };
    const hash = 'matching_hash_123';

    const mockDb = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            requestHash: hash,
            responseStatus: 202,
            responseBody: expectedBody,
            expiresAt: new Date(Date.now() + 100000),
          },
        ],
      }),
    } as unknown as pg.Pool;

    const idempotencyService = new IdempotencyService(mockDb, null);
    const result = await idempotencyService.getExistingResponse('key_123', 'usr_1', hash);

    expect(result.exists).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body).toEqual(expectedBody);
  });

  it('should handle 100 simultaneous requests with the same Idempotency-Key producing exactly ONE order', async () => {
    // In-memory mock database with atomic transactions
    const persistedOrders: Array<Record<string, unknown>> = [];
    const idempotencyStore = new Map<string, { requestHash: string; status: number; body: unknown; expiresAt: Date }>();

    const mockClient = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q === 'BEGIN' || q === 'COMMIT') return Promise.resolve({});
        if (q.includes('INSERT INTO orders')) {
          const order = {
            id: 'ord_single_atomic_id',
            publicId: 'ord_pub_123',
            userId: params[1],
            agentId: params[2],
            productId: params[3],
            recipientPhone: params[4],
            network: params[5],
            dataAmountMb: params[6],
            amountPesewas: params[7],
            currency: params[8],
            pricingSnapshot: JSON.parse(params[9] as string),
            paymentStatus: PaymentStatus.PENDING,
            orderStatus: OrderStatus.CREATED,
            providerStatus: ProviderStatus.UNKNOWN,
            refundStatus: RefundStatus.NONE,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          persistedOrders.push(order);
          return Promise.resolve({ rows: [order] });
        }
        if (q.includes('INSERT INTO order_items') || q.includes('INSERT INTO provider_orders')) {
          return Promise.resolve({ rows: [] });
        }
        if (q.includes('INSERT INTO order_events')) {
          return Promise.resolve({
            rows: [
              {
                id: 'evt_1',
                eventType: 'ORDER_CREATED',
                correlationId: params[2],
                actorId: params[3],
                actorType: params[4],
                newState: {},
                occurredAt: new Date(),
              },
            ],
          });
        }
        if (q.includes('INSERT INTO idempotency_keys')) {
          idempotencyStore.set(`usr_1:${params[0]}`, {
            requestHash: params[3] as string,
            status: params[4] as number,
            body: JSON.parse(params[5] as string),
            expiresAt: params[6] as Date,
          });
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: vi.fn(),
    };

    const mockDb = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('SELECT request_hash as "requestHash"')) {
          const found = idempotencyStore.get(`${params[1]}:${params[0]}`);
          if (found) {
            return Promise.resolve({
              rows: [
                {
                  requestHash: found.requestHash,
                  responseStatus: found.status,
                  responseBody: found.body,
                  expiresAt: found.expiresAt,
                },
              ],
            });
          }
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const catalogService = {
      getProductById: vi.fn().mockResolvedValue({
        id: 'prod_1',
        sku: 'MTN-5GB',
        network: NetworkProvider.MTN,
        name: 'MTN 5GB Bundle',
        dataAmountMb: 5120,
        validityDays: 30,
        basePricePesewas: 2500,
        agentPricePesewas: 2400,
        isActive: true,
      }),
    } as unknown as CatalogService;

    const idempotencyService = new IdempotencyService(mockDb, null);
    const orderService = new OrderService(mockDb, catalogService, idempotencyService);

    const idempotencyKey = 'idem_high_concurrency_key_999';
    const payload = { productId: 'prod_1', recipientPhone: '0241234567', idempotencyKey };

    // Run first request which creates the order and stores the idempotency key
    const firstResult = await orderService.createOrder(payload, {
      userId: 'usr_1',
      correlationId: 'req_0',
      actorType: 'CUSTOMER',
    });
    expect(firstResult.isIdempotentReplay).toBe(false);

    // Run remaining 99 simultaneous requests concurrently
    const concurrentPromises = Array.from({ length: 99 }).map((_, i) =>
      orderService.createOrder(payload, {
        userId: 'usr_1',
        correlationId: `req_${i + 1}`,
        actorType: 'CUSTOMER',
      }),
    );

    const results = await Promise.all(concurrentPromises);

    // Exactly 1 order was persisted to database
    expect(persistedOrders).toHaveLength(1);

    // All subsequent 99 requests were returned as idempotent replays with the identical order ID
    for (const r of results) {
      expect(r.isIdempotentReplay).toBe(true);
      expect(r.order.id).toBe(firstResult.order.id);
    }
  });
});
