import crypto from 'node:crypto';
import type pg from 'pg';
import {
  NetworkProvider,
  Currency,
  OrderStatus,
  PaymentStatus,
  ProviderStatus,
  RefundStatus,
  OrderEventType,
  CreateOrderRequest,
  OrderSummaryDto,
  OrderDetailsDto,
  OrderPricingSnapshot,
  PaginatedResponse,
} from '@bytebeacon/shared';
import { OrderStateMachine } from './order-state-machine.js';
import { CatalogService } from './catalog.service.js';
import { IdempotencyService } from './idempotency.service.js';
import { NotFoundError, ForbiddenError } from '../errors/app-error.js';

export interface CreateOrderContext {
  userId: string;
  correlationId: string;
  actorType: 'CUSTOMER' | 'AGENT' | 'ADMIN';
  agentId?: string;
  ipAddress?: string;
}

export class OrderService {
  private readonly db: pg.Pool;
  private readonly catalogService: CatalogService;
  private readonly idempotencyService: IdempotencyService;

  constructor(
    db: pg.Pool,
    catalogService: CatalogService,
    idempotencyService: IdempotencyService,
  ) {
    this.db = db;
    this.catalogService = catalogService;
    this.idempotencyService = idempotencyService;
  }

  public async createOrder(
    input: CreateOrderRequest,
    context: CreateOrderContext,
  ): Promise<{ order: OrderDetailsDto; isIdempotentReplay: boolean }> {
    const requestHash = this.idempotencyService.computeHash(input);

    // 1. Idempotency pre-check
    if (input.idempotencyKey) {
      const existing = await this.idempotencyService.getExistingResponse(
        input.idempotencyKey,
        context.userId,
        requestHash,
      );

      if (existing.exists && existing.body) {
        return {
          order: existing.body as OrderDetailsDto,
          isIdempotentReplay: true,
        };
      }
    }

    // 2. Resolve Product & Authoritative Pricing from Server Catalog
    const product = await this.catalogService.getProductById(input.productId);

    const pricePesewas =
      context.actorType === 'AGENT' && product.agentPricePesewas
        ? product.agentPricePesewas
        : product.basePricePesewas;

    const publicId = `ord_${crypto.randomBytes(12).toString('hex')}`;
    const cleanPhone = input.recipientPhone.trim().replace(/\s+/g, '');

    const pricingSnapshot: OrderPricingSnapshot = {
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      network: product.network,
      dataAmountMb: product.dataAmountMb,
      unitPricePesewas: pricePesewas,
      currency: Currency.GHS,
      snapshotTimestamp: new Date().toISOString(),
    };

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // 3. Insert Order
      const insertOrderQuery = `
        INSERT INTO orders (
          public_id, user_id, agent_id, product_id, recipient_phone,
          network, data_amount_mb, amount_pesewas, currency,
          pricing_snapshot, payment_status, order_status, provider_status,
          refund_status, idempotency_key
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id, public_id as "publicId", user_id as "userId", agent_id as "agentId",
                  product_id as "productId", recipient_phone as "recipientPhone",
                  network, data_amount_mb as "dataAmountMb", amount_pesewas as "amountPesewas",
                  currency, pricing_snapshot as "pricingSnapshot", payment_status as "paymentStatus",
                  order_status as "orderStatus", provider_status as "providerStatus",
                  refund_status as "refundStatus", created_at as "createdAt", updated_at as "updatedAt"
      `;

      const orderRes = await client.query(insertOrderQuery, [
        publicId,
        context.userId,
        context.agentId || null,
        product.id,
        cleanPhone,
        product.network,
        product.dataAmountMb,
        pricePesewas,
        Currency.GHS,
        JSON.stringify(pricingSnapshot),
        PaymentStatus.PENDING,
        OrderStatus.CREATED,
        ProviderStatus.UNKNOWN,
        RefundStatus.NONE,
        input.idempotencyKey || null,
      ]);

      const orderRow = orderRes.rows[0];

      // 4. Insert Order Item
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price_pesewas, total_pesewas)
         VALUES ($1, $2, 1, $3, $3)`,
        [orderRow.id, product.id, pricePesewas],
      );

      // 5. Insert Initial Provider Order Projection
      await client.query(
        `INSERT INTO provider_orders (order_id, provider_name, provider_status)
         VALUES ($1, 'GMPL', 'UNKNOWN')`,
        [orderRow.id],
      );

      // 6. Insert Order Event
      const eventRes = await client.query(
        `INSERT INTO order_events (order_id, event_type, correlation_id, actor_id, actor_type, source, new_state)
         VALUES ($1, $2, $3, $4, $5, 'API', $6)
         RETURNING id, event_type as "eventType", correlation_id as "correlationId",
                   actor_id as "actorId", actor_type as "actorType",
                   previous_state as "previousState", new_state as "newState",
                   metadata, occurred_at as "occurredAt"`,
        [
          orderRow.id,
          OrderEventType.ORDER_CREATED,
          context.correlationId,
          context.userId,
          context.actorType,
          JSON.stringify({
            orderStatus: OrderStatus.CREATED,
            paymentStatus: PaymentStatus.PENDING,
          }),
        ],
      );

      const orderDetails: OrderDetailsDto = {
        id: orderRow.id,
        publicId: orderRow.publicId,
        userId: orderRow.userId,
        agentId: orderRow.agentId,
        recipientPhone: orderRow.recipientPhone,
        network: orderRow.network as NetworkProvider,
        dataAmountMb: orderRow.dataAmountMb,
        amountPesewas: parseInt(orderRow.amountPesewas, 10),
        currency: orderRow.currency as Currency,
        paymentStatus: orderRow.paymentStatus as PaymentStatus,
        orderStatus: orderRow.orderStatus as OrderStatus,
        providerStatus: orderRow.providerStatus as ProviderStatus,
        refundStatus: orderRow.refundStatus as RefundStatus,
        pricingSnapshot,
        providerOrder: {
          providerName: 'GMPL',
          providerReference: null,
          providerStatus: ProviderStatus.UNKNOWN,
          lastSyncedAt: null,
          lastProviderEventAt: null,
          syncVersion: 0,
        },
        events: [
          {
            id: eventRes.rows[0].id,
            eventType: eventRes.rows[0].eventType as OrderEventType,
            correlationId: eventRes.rows[0].correlationId,
            actorId: eventRes.rows[0].actorId,
            actorType: eventRes.rows[0].actorType,
            previousState: null,
            newState: eventRes.rows[0].newState,
            metadata: eventRes.rows[0].metadata,
            occurredAt: new Date(eventRes.rows[0].occurredAt).toISOString(),
          },
        ],
        createdAt: new Date(orderRow.createdAt).toISOString(),
        updatedAt: new Date(orderRow.updatedAt).toISOString(),
      };

      // 7. Save Idempotency Record atomically inside the same transaction
      if (input.idempotencyKey) {
        await this.idempotencyService.saveResponse(client, {
          key: input.idempotencyKey,
          userId: context.userId,
          endpoint: '/api/v1/orders',
          requestHash,
          responseStatus: 202,
          responseBody: orderDetails,
        });
      }

      await client.query('COMMIT');

      return {
        order: orderDetails,
        isIdempotentReplay: false,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async getOrderById(
    orderIdOrPublicId: string,
    userId: string,
    isAdmin = false,
  ): Promise<OrderDetailsDto> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      orderIdOrPublicId,
    );

    const query = `
      SELECT o.id, o.public_id as "publicId", o.user_id as "userId", o.agent_id as "agentId",
             o.recipient_phone as "recipientPhone", o.network, o.data_amount_mb as "dataAmountMb",
             o.amount_pesewas as "amountPesewas", o.currency, o.pricing_snapshot as "pricingSnapshot",
             o.payment_status as "paymentStatus", o.order_status as "orderStatus",
             o.provider_status as "providerStatus", o.refund_status as "refundStatus",
             o.created_at as "createdAt", o.updated_at as "updatedAt",
             po.provider_name as "poProviderName", po.provider_reference as "poProviderReference",
             po.provider_status as "poProviderStatus", po.last_synced_at as "poLastSyncedAt",
             po.last_provider_event_at as "poLastProviderEventAt", po.sync_version as "poSyncVersion"
      FROM orders o
      LEFT JOIN provider_orders po ON o.id = po.order_id
      WHERE ${isUuid ? 'o.id = $1' : 'o.public_id = $1'}
    `;

    const result = await this.db.query(query, [orderIdOrPublicId]);
    if (result.rows.length === 0) {
      throw new NotFoundError(`Order '${orderIdOrPublicId}' not found`);
    }

    const row = result.rows[0];

    // Strict Cross-Tenant Authorization Check
    if (!isAdmin && row.userId !== userId) {
      throw new ForbiddenError('You are not authorized to access this order record');
    }

    // Fetch Events History
    const eventsQuery = `
      SELECT id, event_type as "eventType", correlation_id as "correlationId",
             actor_id as "actorId", actor_type as "actorType",
             previous_state as "previousState", new_state as "newState",
             metadata, occurred_at as "occurredAt"
      FROM order_events
      WHERE order_id = $1
      ORDER BY occurred_at ASC
    `;
    const eventsRes = await this.db.query(eventsQuery, [row.id]);

    return {
      id: row.id,
      publicId: row.publicId,
      userId: row.userId,
      agentId: row.agentId,
      recipientPhone: row.recipientPhone,
      network: row.network as NetworkProvider,
      dataAmountMb: row.dataAmountMb,
      amountPesewas: parseInt(row.amountPesewas, 10),
      currency: row.currency as Currency,
      paymentStatus: row.paymentStatus as PaymentStatus,
      orderStatus: row.orderStatus as OrderStatus,
      providerStatus: row.providerStatus as ProviderStatus,
      refundStatus: row.refundStatus as RefundStatus,
      pricingSnapshot: row.pricingSnapshot,
      providerOrder: row.poProviderName
        ? {
            providerName: row.poProviderName,
            providerReference: row.poProviderReference,
            providerStatus: row.poProviderStatus as ProviderStatus,
            lastSyncedAt: row.poLastSyncedAt ? new Date(row.poLastSyncedAt).toISOString() : null,
            lastProviderEventAt: row.poLastProviderEventAt
              ? new Date(row.poLastProviderEventAt).toISOString()
              : null,
            syncVersion: row.poSyncVersion || 0,
          }
        : null,
      events: eventsRes.rows.map((e) => ({
        id: e.id,
        eventType: e.eventType as OrderEventType,
        correlationId: e.correlationId,
        actorId: e.actorId,
        actorType: e.actorType,
        previousState: e.previousState,
        newState: e.newState,
        metadata: e.metadata,
        occurredAt: new Date(e.occurredAt).toISOString(),
      })),
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  public async listOrders(
    userId: string,
    isAdmin = false,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<OrderSummaryDto>> {
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, public_id as "publicId", user_id as "userId", agent_id as "agentId",
             recipient_phone as "recipientPhone", network, data_amount_mb as "dataAmountMb",
             amount_pesewas as "amountPesewas", currency,
             payment_status as "paymentStatus", order_status as "orderStatus",
             provider_status as "providerStatus", refund_status as "refundStatus",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM orders
    `;
    const params: unknown[] = [];

    if (!isAdmin) {
      query += ' WHERE user_id = $1';
      params.push(userId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    const countQuery = isAdmin
      ? 'SELECT COUNT(*) as total FROM orders'
      : 'SELECT COUNT(*) as total FROM orders WHERE user_id = $1';
    const countParams = isAdmin ? [] : [userId];
    const countRes = await this.db.query<{ total: string }>(countQuery, countParams);
    const total = parseInt(countRes.rows[0].total, 10) || 0;

    return {
      items: result.rows.map((r) => ({
        id: r.id,
        publicId: r.publicId,
        userId: r.userId,
        agentId: r.agentId,
        recipientPhone: r.recipientPhone,
        network: r.network as NetworkProvider,
        dataAmountMb: r.dataAmountMb,
        amountPesewas: parseInt(r.amountPesewas, 10),
        currency: r.currency as Currency,
        paymentStatus: r.paymentStatus as PaymentStatus,
        orderStatus: r.orderStatus as OrderStatus,
        providerStatus: r.providerStatus as ProviderStatus,
        refundStatus: r.refundStatus as RefundStatus,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString(),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public async cancelOrder(
    orderId: string,
    userId: string,
    correlationId: string,
    isAdmin = false,
  ): Promise<OrderDetailsDto> {
    const order = await this.getOrderById(orderId, userId, isAdmin);

    // Validate Transition via State Machine
    OrderStateMachine.validateTransition(order.orderStatus, OrderStatus.CANCELLED);

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [OrderStatus.CANCELLED, order.id],
      );

      await client.query(
        `INSERT INTO order_events (order_id, event_type, correlation_id, actor_id, actor_type, source, previous_state, new_state)
         VALUES ($1, $2, $3, $4, $5, 'API', $6, $7)`,
        [
          order.id,
          OrderEventType.ORDER_CANCELLED,
          correlationId,
          userId,
          isAdmin ? 'ADMIN' : 'CUSTOMER',
          JSON.stringify({ orderStatus: order.orderStatus }),
          JSON.stringify({ orderStatus: OrderStatus.CANCELLED }),
        ],
      );

      await client.query('COMMIT');

      return await this.getOrderById(order.id, userId, isAdmin);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
