-- =============================================
-- BYTEBEACON AGENT STORE & RESELLER MARKETPLACE SCHEMA
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. AGENT STORES TABLE
CREATE TABLE IF NOT EXISTS agent_stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
    store_name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    phone VARCHAR(20) NOT NULL,
    logo_url TEXT,
    review_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW', -- PENDING_REVIEW, APPROVED, REJECTED, CHANGES_REQUESTED, SUSPENDED
    activation_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID', -- UNPAID, PAID, REFUNDED
    admin_notes TEXT,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for agent_stores
CREATE INDEX IF NOT EXISTS idx_agent_stores_user ON agent_stores(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_stores_slug ON agent_stores(slug);
CREATE INDEX IF NOT EXISTS idx_agent_stores_review ON agent_stores(review_status);
CREATE INDEX IF NOT EXISTS idx_agent_stores_activation ON agent_stores(activation_status);

-- 2. ACTIVATION PAYMENTS TABLE (GHS 100 Activation Fee)
CREATE TABLE IF NOT EXISTS agent_store_activation_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES agent_stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
    amount_ghc DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    paystack_reference VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, completed, failed
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activation_payments_store ON agent_store_activation_payments(store_id);
CREATE INDEX IF NOT EXISTS idx_activation_payments_ref ON agent_store_activation_payments(paystack_reference);

-- 3. AGENT STORE PRODUCTS / PRICING
CREATE TABLE IF NOT EXISTS agent_store_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES agent_stores(id) ON DELETE CASCADE,
    bundle_id UUID NOT NULL REFERENCES data_bundles(id) ON DELETE CASCADE,
    agent_price_ghc DECIMAL(10,2) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, bundle_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_products_store ON agent_store_products(store_id);
CREATE INDEX IF NOT EXISTS idx_agent_products_bundle ON agent_store_products(bundle_id);

-- 4. AGENT ORDERS TABLE (Customer Storefront Purchases)
CREATE TABLE IF NOT EXISTS agent_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES agent_stores(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
    bundle_id UUID REFERENCES data_bundles(id) ON DELETE SET NULL,
    customer_phone VARCHAR(20) NOT NULL,
    network VARCHAR(20) NOT NULL,
    data_amount VARCHAR(50) NOT NULL,
    base_price_ghc DECIMAL(10,2) NOT NULL,
    selling_price_ghc DECIMAL(10,2) NOT NULL,
    profit_ghc DECIMAL(10,2) NOT NULL,
    paystack_reference VARCHAR(255) UNIQUE,
    provider_reference VARCHAR(255),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, paid, failed, refunded
    fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_orders_store ON agent_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_agent_orders_agent ON agent_orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_orders_paystack ON agent_orders(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_agent_orders_created ON agent_orders(created_at);

-- 5. AGENT WALLETS TABLE
CREATE TABLE IF NOT EXISTS agent_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID UNIQUE NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
    available_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    pending_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_profit_earned DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_withdrawn DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_wallets_agent ON agent_wallets(agent_id);

-- 6. AGENT WALLET LEDGER TABLE
CREATE TABLE IF NOT EXISTS agent_wallet_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
    store_id UUID REFERENCES agent_stores(id) ON DELETE SET NULL,
    order_id UUID REFERENCES agent_orders(id) ON DELETE SET NULL,
    type VARCHAR(30) NOT NULL, -- SALE_PROFIT, WITHDRAWAL, REFUND, REVERSAL, ADJUSTMENT
    amount_ghc DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    description TEXT,
    reference VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_ledger_agent ON agent_wallet_ledger(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_ledger_type ON agent_wallet_ledger(type);

-- 7. AGENT WITHDRAWALS TABLE
CREATE TABLE IF NOT EXISTS agent_withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
    store_id UUID REFERENCES agent_stores(id) ON DELETE SET NULL,
    amount_ghc DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'momo', -- momo, bank
    account_number VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    bank_momo_provider VARCHAR(50) NOT NULL, -- mtn, telecel, airteltigo, gcb, ecobank, etc.
    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED', -- REQUESTED, PENDING, PROCESSING, COMPLETED, FAILED
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_withdrawals_agent ON agent_withdrawals(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_withdrawals_status ON agent_withdrawals(status);

-- 8. AGENT PRICING RULES (Global Admin Controls)
CREATE TABLE IF NOT EXISTS agent_pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    min_markup_ghc DECIMAL(10,2) NOT NULL DEFAULT 0.50,
    max_markup_ghc DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    min_withdrawal_ghc DECIMAL(10,2) NOT NULL DEFAULT 20.00,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
