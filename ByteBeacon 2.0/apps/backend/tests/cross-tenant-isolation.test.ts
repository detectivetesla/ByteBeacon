import { describe, it, expect, vi } from 'vitest';
import { OrderService } from '../src/core/commerce/order.service.js';
import { CatalogService } from '../src/core/commerce/catalog.service.js';
import { IdempotencyService } from '../src/core/commerce/idempotency.service.js';
import { NetworkProvider, OrderStatus, PaymentStatus, ProviderStatus, RefundStatus } from '@bytebeacon/shared';
import type pg from 'pg';

describe('Cross-Tenant Isolation & Order Access Control', () => {
  it('should prevent customer from accessing another customer order and allow admin access', async () => {
    const mockDb = {
      query: vi.fn().mockImplementation((q: string, params: unknown[]) => {
        if (q.includes('FROM orders o')) {
          if (params[0] === 'ord_user_a') {
            return Promise.resolve({
              rows: [
                {
                  id: 'ord_user_a',
                  publicId: 'ord_pub_aaa',
                  userId: 'usr_owner_a',
                  agentId: null,
                  recipientPhone: '0241111111',
                  network: NetworkProvider.MTN,
                  dataAmountMb: 1024,
                  amountPesewas: '1000',
                  currency: 'GHS',
                  pricingSnapshot: {},
                  paymentStatus: PaymentStatus.PENDING,
                  orderStatus: OrderStatus.CREATED,
                  providerStatus: ProviderStatus.UNKNOWN,
                  refundStatus: RefundStatus.NONE,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ],
            });
          }
        }
        if (q.includes('FROM order_events')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const catalogService = {} as CatalogService;
    const idempotencyService = new IdempotencyService(mockDb, null);
    const orderService = new OrderService(mockDb, catalogService, idempotencyService);

    // 1. Owner can access their own order
    const ownerAccess = await orderService.getOrderById('ord_user_a', 'usr_owner_a', false);
    expect(ownerAccess.id).toBe('ord_user_a');

    // 2. Another customer accessing user A's order should throw ForbiddenError
    await expect(
      orderService.getOrderById('ord_user_a', 'usr_intruder_b', false),
    ).rejects.toThrow('You are not authorized to access this order record');

    // 3. Admin can access user A's order
    const adminAccess = await orderService.getOrderById('ord_user_a', 'usr_admin', true);
    expect(adminAccess.id).toBe('ord_user_a');
  });
});
