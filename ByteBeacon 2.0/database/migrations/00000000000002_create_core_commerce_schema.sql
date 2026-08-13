-- ==============================================================================
-- Migration: 00000000000002_create_core_commerce_schema.sql
-- Description: Core Commerce, Dual-State Order Projections, Idempotency & Events
-- Invariant: Minor Units (Ghanaian Pesewas BIGINT), Server-Authoritative Pricing
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CATALOG PRODUCTS (Products & Plans, Strict Pesewas Integer Pricing)
CREATE TABLE IF NOT EXISTS catalog_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    network VARCHAR(30) NOT NULL CHECK (network IN ('MTN', 'TELECEL', 'AIRTELTIGO')),
    name VARCHAR(255) NOT NULL,
    data_amount_mb INT NOT NULL CHECK (data_amount_mb > 0),
    validity_days INT NOT NULL DEFAULT 30 CHECK (validity_days > 0),
    base_price_pesewas BIGINT NOT NULL CHECK (base_price_pesewas > 0),
    agent_price_pesewas BIGINT CHECK (agent_price_pesewas IS NULL OR agent_price_pesewas > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_network_active ON catalog_products(network, is_active);
CREATE INDEX IF NOT EXISTS idx_catalog_sku ON catalog_products(sku);

-- 2. AGENTS
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agents_slug ON agents(slug);
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);

-- 3. ORDERS (Local Projection, 4 Discrete Status Dimensions)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE RESTRICT,
    recipient_phone VARCHAR(30) NOT NULL,
    network VARCHAR(30) NOT NULL CHECK (network IN ('MTN', 'TELECEL', 'AIRTELTIGO')),
    data_amount_mb INT NOT NULL CHECK (data_amount_mb > 0),
    amount_pesewas BIGINT NOT NULL CHECK (amount_pesewas > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
    pricing_snapshot JSONB NOT NULL,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (payment_status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED')),
    order_status VARCHAR(30) NOT NULL DEFAULT 'CREATED'
        CHECK (order_status IN ('CREATED', 'VALIDATING', 'READY_FOR_FULFILLMENT', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    provider_status VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN'
        CHECK (provider_status IN ('UNKNOWN', 'RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED')),
    refund_status VARCHAR(30) NOT NULL DEFAULT 'NONE'
        CHECK (refund_status IN ('NONE', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NOT_REQUIRED')),
    idempotency_key VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_public_id ON orders(public_id);
CREATE INDEX IF NOT EXISTS idx_orders_statuses ON orders(order_status, payment_status, provider_status);
CREATE INDEX IF NOT EXISTS idx_orders_recipient ON orders(recipient_phone);

-- 4. PROVIDER ORDERS (Separated Provider Projection & Sync Versioning)
CREATE TABLE IF NOT EXISTS provider_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider_name VARCHAR(50) NOT NULL DEFAULT 'GMPL',
    provider_order_id VARCHAR(255),
    provider_reference VARCHAR(255) UNIQUE,
    provider_status VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN'
        CHECK (provider_status IN ('UNKNOWN', 'RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED')),
    raw_payload JSONB,
    last_synced_at TIMESTAMPTZ,
    last_provider_event_at TIMESTAMPTZ,
    sync_version INT NOT NULL DEFAULT 0,
    sync_metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_provider_orders_reference ON provider_orders(provider_reference);
CREATE INDEX IF NOT EXISTS idx_provider_orders_order_id ON provider_orders(order_id);

-- 5. ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price_pesewas BIGINT NOT NULL CHECK (unit_price_pesewas > 0),
    total_pesewas BIGINT NOT NULL CHECK (total_pesewas > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- 6. ORDER EVENTS (Immutable Audit Ledger)
CREATE TABLE IF NOT EXISTS order_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    actor_id UUID,
    actor_type VARCHAR(50) NOT NULL, -- CUSTOMER, ADMIN, AGENT, SYSTEM, PROVIDER
    source VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    previous_state JSONB,
    new_state JSONB,
    metadata JSONB NOT NULL DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id, occurred_at ASC);
CREATE INDEX IF NOT EXISTS idx_order_events_correlation ON order_events(correlation_id);

-- 7. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount_pesewas BIGINT NOT NULL CHECK (amount_pesewas > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
    provider VARCHAR(50) NOT NULL DEFAULT 'PAYSTACK',
    provider_reference VARCHAR(255) UNIQUE,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'MOMO',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(provider_reference);

-- 8. REFUNDS
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payments(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    amount_pesewas BIGINT NOT NULL CHECK (amount_pesewas > 0),
    reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('NONE', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NOT_REQUIRED')),
    provider_refund_reference VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);

-- 9. BENEFICIARY VALIDATION (MTN / Telecom Pre-Check)
CREATE TABLE IF NOT EXISTS beneficiary_validation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(30) NOT NULL,
    network VARCHAR(30) NOT NULL CHECK (network IN ('MTN', 'TELECEL', 'AIRTELTIGO')),
    validation_status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID', 'EXPIRED', 'ERROR')),
    provider_reference VARCHAR(255),
    provider_response_metadata JSONB NOT NULL DEFAULT '{}',
    validated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_beneficiary_phone_network ON beneficiary_validation(phone_number, network);

-- 10. BULK SUBMISSIONS & ITEMS
CREATE TABLE IF NOT EXISTS bulk_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    total_count INT NOT NULL DEFAULT 0,
    processed_count INT NOT NULL DEFAULT 0,
    success_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    total_amount_pesewas BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED')),
    idempotency_key VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bulk_submissions_user ON bulk_submissions(user_id);

CREATE TABLE IF NOT EXISTS bulk_submission_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES bulk_submissions(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    recipient_phone VARCHAR(30) NOT NULL,
    product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE RESTRICT,
    amount_pesewas BIGINT NOT NULL CHECK (amount_pesewas > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bulk_items_submission ON bulk_submission_items(submission_id);

-- 11. IDEMPOTENCY KEYS (PostgreSQL as Durable Authority)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_status INT NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- 12. PROVIDER SYNC RECORDS (Event Versioning & Stale Event Protection)
CREATE TABLE IF NOT EXISTS provider_sync_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider_name VARCHAR(50) NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL,
    event_version BIGINT NOT NULL DEFAULT 1,
    status_received VARCHAR(50) NOT NULL,
    is_applied BOOLEAN NOT NULL DEFAULT FALSE,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_records_order ON provider_sync_records(order_id, event_timestamp DESC);
