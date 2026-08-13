import { describe, it, expect, vi } from 'vitest';
import { OrderService } from '../src/core/commerce/order.service.js';
import { CatalogService } from '../src/core/commerce/catalog.service.js';
import { IdempotencyService } from '../src/core/commerce/idempotency.service.js';
import {
  NetworkProvider,
  OrderStatus,
  PaymentStatus,
  ProviderStatus,
  RefundStatus,
  OrderEventType,
} from '@bytebeacon/shared';
import type pg from 'pg';

describe('Order Creation & Authoritative Pricing', () => {
  it('should resolve price from catalog in pesewas, create immutable pricing snapshot and initial provider projection', async () => {
    const mockDb = {
      connect: vi.fn().mockReturnValue({
        query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
          if (q === 'BEGIN' || q === 'COMMIT') return Promise.resolve({});
          if (q.includes('INSERT INTO orders')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'ord_123_uuid',
                  publicId: params[0],
                  userId: params[1],
                  agentId: params[2],
                  productId: params[3],
                  recipientPhone: params[4],
                  network: params[5],
                  dataAmountMb: params[6],
                  amountPesewas: params[7],
                  currency: params[8],
                  pricingSnapshot: JSON.parse(params[9] as string),
                  paymentStatus: params[10],
                  orderStatus: params[11],
                  providerStatus: params[12],
                  refundStatus: params[13],
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ],
            });
          }
          if (q.includes('INSERT INTO order_items')) {
            return Promise.resolve({ rows: [] });
          }
          if (q.includes('INSERT INTO provider_orders')) {
            return Promise.resolve({ rows: [] });
          }
          if (q.includes('INSERT INTO order_events')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'evt_1',
                  eventType: OrderEventType.ORDER_CREATED,
                  correlationId: params[2],
                  actorId: params[3],
                  actorType: params[4],
                  newState: JSON.parse(params[6] as string),
                  occurredAt: new Date(),
                },
              ],
            });
          }
          return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
      }),
    } as unknown as pg.Pool;

    const catalogService = {
      getProductById: vi.fn().mockResolvedValue({
        id: 'prod_mtn_10gb',
        sku: 'MTN-10GB-30D',
        network: NetworkProvider.MTN,
        name: 'MTN 10GB Non-Expiry Bundle',
        dataAmountMb: 10240,
        validityDays: 30,
        basePricePesewas: 4500, // GHS 45.00
        agentPricePesewas: 4300, // GHS 43.00 for agents
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    } as unknown as CatalogService;

    const idempotencyService = new IdempotencyService(mockDb, null);
    const orderService = new OrderService(mockDb, catalogService, idempotencyService);

    const result = await orderService.createOrder(
      {
        productId: 'prod_mtn_10gb',
        recipientPhone: '0241234567',
      },
      {
        userId: 'usr_cust_1',
        correlationId: 'req_test_001',
        actorType: 'CUSTOMER',
      },
    );

    expect(result.isIdempotentReplay).toBe(false);
    expect(result.order.amountPesewas).toBe(4500); // 4500 pesewas
    expect(result.order.recipientPhone).toBe('0241234567');
    expect(result.order.orderStatus).toBe(OrderStatus.CREATED);
    expect(result.order.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(result.order.providerStatus).toBe(ProviderStatus.UNKNOWN);
    expect(result.order.refundStatus).toBe(RefundStatus.NONE);

    // Verify Pricing Snapshot
    expect(result.order.pricingSnapshot.unitPricePesewas).toBe(4500);
    expect(result.order.pricingSnapshot.sku).toBe('MTN-10GB-30D');

    // Verify Provider Order Projection
    expect(result.order.providerOrder).toBeDefined();
    expect(result.order.providerOrder?.providerName).toBe('GMPL');
    expect(result.order.providerOrder?.providerStatus).toBe(ProviderStatus.UNKNOWN);

    // Verify Order Events
    expect(result.order.events).toHaveLength(1);
    expect(result.order.events[0].eventType).toBe(OrderEventType.ORDER_CREATED);
    expect(result.order.events[0].correlationId).toBe('req_test_001');
  });
});
