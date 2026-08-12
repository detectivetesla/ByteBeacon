/**
 * Database Initialization
 * Ensures required tables exist in the database
 */
const pool = require('../config/database');

/**
 * Create messages and notifications tables if they don't exist
 */
const initializeTables = async () => {
    try {
        // Try to alter user_role enum to add superagent (must be run outside transaction)
        try {
            await pool.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superagent'");
            console.log("✅ Checked/Altered user_role type to include 'superagent'");
        } catch (e) {
            // Ignore if type doesn't exist or already has value
        }

        // Create messages table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS messages (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                sender_id VARCHAR(36) NOT NULL,
                recipient_id VARCHAR(36) NOT NULL,
                subject VARCHAR(255),
                body TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes for messages
        await pool.execute(`
            CREATE INDEX IF NOT EXISTS idx_msg_sender ON messages(sender_id)
        `).catch(() => { }); // Ignore if already exists
        await pool.execute(`
            CREATE INDEX IF NOT EXISTS idx_msg_recipient ON messages(recipient_id)
        `).catch(() => { });

        // Create notifications table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(20) DEFAULT 'info',
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create index for notifications
        await pool.execute(`
            CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id)
        `).catch(() => { });

        // Create wallet_credit_requests table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS wallet_credit_requests (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                amount NUMERIC(10, 2) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                admin_notes TEXT,
                agent_notes TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create index for wallet_credit_requests
        await pool.execute(`
            CREATE INDEX IF NOT EXISTS idx_credit_req_user ON wallet_credit_requests(user_id)
        `).catch(() => { });

        // migrations: ensure is_active column exists in users table
        try {
            await pool.execute(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
                        ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
                    END IF;
                END $$;
            `).catch(() => { });

            // migrations: ensure retry columns exist in transactions table
            console.log('🛠️ Checking/Adding transaction retry columns...');
            await pool.execute(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'retry_count') THEN
                        ALTER TABLE transactions ADD COLUMN retry_count INTEGER DEFAULT 0;
                    END IF;
                    
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'next_retry_at') THEN
                        ALTER TABLE transactions ADD COLUMN next_retry_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
                    END IF;
                    
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'failure_reason') THEN
                        ALTER TABLE transactions ADD COLUMN failure_reason TEXT;
                    END IF;
                END $$;
            `).catch(err => {
                console.log('ℹ️ Note while adding transaction retry columns:', err.message);
            });
            console.log('✅ Checked/Added transaction retry columns');

            // migrations: Move stuck 'pending' orders to 'processing' so they get picked up by the new queue
            console.log('🛠️ Migrating stuck pending orders...');
            const [migrationResult] = await pool.execute(`
                UPDATE transactions 
                SET status = 'processing', updated_at = CURRENT_TIMESTAMP 
                WHERE status = 'pending'
            `);
            if (migrationResult.affectedRows > 0) {
                console.log(`✅ Migrated ${migrationResult.affectedRows} stuck pending orders to processing`);
            }

            console.log('🛠️ Checking/Creating Reseller Platform tables...');
            // Create partners table
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS partners (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID REFERENCES users(uuid) ON DELETE SET NULL,
                    business_name VARCHAR(255) NOT NULL,
                    contact_name VARCHAR(255),
                    email VARCHAR(255) NOT NULL UNIQUE,
                    phone VARCHAR(20),
                    api_key VARCHAR(255) NOT NULL UNIQUE,
                    api_secret_encrypted TEXT NOT NULL,
                    api_secret_iv VARCHAR(255) NOT NULL,
                    api_secret_auth_tag VARCHAR(255) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    wallet_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    credit_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                    credit_limit DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    allow_unlimited_purchases BOOLEAN NOT NULL DEFAULT FALSE,
                    outstanding_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    settlement_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
                    ip_whitelist TEXT,
                    webhook_url VARCHAR(255),
                    rate_limit_rpm INTEGER DEFAULT 60,
                    rate_limit_rph INTEGER DEFAULT 1000,
                    rate_limit_rpd INTEGER DEFAULT 10000,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create partner_ledger table
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS partner_ledger (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
                    type VARCHAR(20) NOT NULL,
                    amount DECIMAL(10,2) NOT NULL,
                    description TEXT,
                    reference VARCHAR(255),
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create indexes for partner_ledger
            await pool.execute(`
                CREATE INDEX IF NOT EXISTS idx_partner_ledger_partner ON partner_ledger(partner_id)
            `).catch(() => {});

            // Create partner_invoices table
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS partner_invoices (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
                    invoice_number VARCHAR(50) NOT NULL UNIQUE,
                    billing_period_start TIMESTAMPTZ NOT NULL,
                    billing_period_end TIMESTAMPTZ NOT NULL,
                    total_purchases DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    payments_made DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    outstanding_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create partner_webhook_logs table
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS partner_webhook_logs (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
                    transaction_id UUID NOT NULL,
                    webhook_url VARCHAR(255) NOT NULL,
                    payload JSONB NOT NULL,
                    attempt INTEGER NOT NULL DEFAULT 1,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    response_code INTEGER,
                    response_body TEXT,
                    next_attempt_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create index for partner_webhook_logs
            await pool.execute(`
                CREATE INDEX IF NOT EXISTS idx_partner_webhook_status ON partner_webhook_logs(status, next_attempt_at)
            `).catch(() => {});

            // Create partner_api_logs table
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS partner_api_logs (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
                    ip_address VARCHAR(45) NOT NULL,
                    method VARCHAR(10) NOT NULL,
                    path VARCHAR(255) NOT NULL,
                    request_body TEXT,
                    response_code INTEGER NOT NULL,
                    user_agent VARCHAR(255),
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Safely drop the foreign key constraint on partner_api_logs to allow logging agent/admin requests
            await pool.execute(`
                ALTER TABLE partner_api_logs DROP CONSTRAINT IF EXISTS partner_api_logs_partner_id_fkey
            `).catch(err => console.log('Info: partner_api_logs constraint drop bypassed or already done:', err.message));

            // Create index for rate limit tracking
            await pool.execute(`
                CREATE INDEX IF NOT EXISTS idx_partner_api_logs_rate ON partner_api_logs(partner_id, created_at)
            `).catch(() => {});

            // Create partner_nonces table
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS partner_nonces (
                    nonce VARCHAR(255) PRIMARY KEY,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create refunds table
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS refunds (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID REFERENCES users(uuid) ON DELETE CASCADE,
                    amount_ghc DECIMAL(10,2) NOT NULL,
                    notes TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create user_api_keys table
            try {
                await pool.execute(`
                    CREATE TABLE IF NOT EXISTS user_api_keys (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        user_id UUID REFERENCES users(uuid) ON DELETE CASCADE,
                        name VARCHAR(255) NOT NULL DEFAULT 'API Key',
                        api_key VARCHAR(255) UNIQUE NOT NULL,
                        is_active BOOLEAN DEFAULT TRUE,
                        last_used TIMESTAMPTZ,
                        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                
                await pool.execute(`
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'name') THEN
                            ALTER TABLE user_api_keys ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT 'API Key';
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'last_used') THEN
                            ALTER TABLE user_api_keys ADD COLUMN last_used TIMESTAMPTZ;
                        END IF;
                    END $$;
                `);
                console.log('✅ Checked/created user_api_keys table');
            } catch (apiKeyTableErr) {
                console.error('⚠️ user_api_keys table check/create error:', apiKeyTableErr.message);
            }

            // Alter transactions table to support partner references
            try {
                await pool.execute(`
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'partner_id') THEN
                            ALTER TABLE transactions ADD COLUMN partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
                        END IF;
                        
                        -- Make user_id nullable in transactions
                        ALTER TABLE transactions ALTER COLUMN user_id DROP NOT NULL;
                    END $$;
                `);
                console.log('✅ Altered transactions table for partners support');
            } catch (alterErr) {
                console.error('⚠️ Transaction table alter error:', alterErr.message);
            }

            // Alter partners table to support test credentials
            try {
                await pool.execute(`
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'test_api_key') THEN
                            ALTER TABLE partners ADD COLUMN test_api_key VARCHAR(255) UNIQUE;
                        END IF;
                        
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'test_api_secret_encrypted') THEN
                            ALTER TABLE partners ADD COLUMN test_api_secret_encrypted TEXT;
                        END IF;

                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'test_api_secret_iv') THEN
                            ALTER TABLE partners ADD COLUMN test_api_secret_iv VARCHAR(255);
                        END IF;

                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'test_api_secret_auth_tag') THEN
                            ALTER TABLE partners ADD COLUMN test_api_secret_auth_tag VARCHAR(255);
                        END IF;
                    END $$;
                `);
                console.log('✅ Altered partners table for test mode credentials');
            } catch (alterErr) {
                console.error('⚠️ Partners table test credentials alter error:', alterErr.message);
            }

            // Alter agent_requests table to support request type
            try {
                await pool.execute(`
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_requests' AND column_name = 'request_type') THEN
                            ALTER TABLE agent_requests ADD COLUMN request_type VARCHAR(20) DEFAULT 'agent';
                        END IF;
                    END $$;
                `);
                console.log('✅ Altered agent_requests table for request_type support');
            } catch (alterErr) {
                console.error('⚠️ agent_requests table alter error:', alterErr.message);
            }

            // Create sourcing_providers table
            try {
                await pool.execute(`
                    CREATE TABLE IF NOT EXISTS sourcing_providers (
                        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        name VARCHAR(100) NOT NULL,
                        slug VARCHAR(50) UNIQUE NOT NULL,
                        provider_type VARCHAR(20) DEFAULT 'custom',
                        base_url VARCHAR(500),
                        api_key TEXT,
                        is_active BOOLEAN DEFAULT FALSE,
                        config JSONB DEFAULT '{}',
                        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log('✅ Created sourcing_providers table');

                // Seed default providers if none exist
                const [providers] = await pool.execute('SELECT COUNT(*)::integer as count FROM sourcing_providers');
                if (providers[0].count === 0) {
                    // Try to get existing system settings keys
                    const [settings] = await pool.execute("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('active_sourcing_api', 'portal02_api_key', 'datahouse_api_key')");
                    let activeApi = 'datahouse';
                    let portalKey = 'dk_iGoTZ6KA8-GDrvemBECywzhisNhOpttr';
                    let dhKey = 'ak_live_ZSZTCREKE6MUEDPXGE5NWT76U5CHOMPQFNI5XOBO';
                    
                    for (const s of settings) {
                        if (s.setting_key === 'active_sourcing_api') activeApi = s.setting_value;
                        if (s.setting_key === 'portal02_api_key') portalKey = s.setting_value;
                        if (s.setting_key === 'datahouse_api_key') dhKey = s.setting_value;
                    }

                    await pool.execute(`
                        INSERT INTO sourcing_providers (name, slug, provider_type, base_url, api_key, is_active)
                        VALUES 
                        ('GetMorePayLess (Datahouse)', 'datahouse', 'builtin', 'https://api.getmorepaylessdatahouse.net/api/v1', ?, ?),
                        ('Portal-02', 'portal02', 'builtin', 'https://www.portal-02.com/api/v1', ?, ?)
                    `, [dhKey, activeApi === 'datahouse', portalKey, activeApi === 'portal02']);
                    console.log('✅ Seeded default sourcing providers from system_settings');
                }
            } catch (providerErr) {
                console.error('⚠️ sourcing_providers table error:', providerErr.message);
            }

            // Alter transactions table to add redesign columns
            try {
                await pool.execute(`
                    DO $$ 
                    BEGIN 
                        -- Add serial_id starting at 3138000
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'serial_id') THEN
                            CREATE SEQUENCE IF NOT EXISTS transaction_serial_id_seq START WITH 3138000;
                            ALTER TABLE transactions ADD COLUMN serial_id INTEGER DEFAULT nextval('transaction_serial_id_seq');
                        END IF;

                        -- Add balance_before
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'balance_before') THEN
                            ALTER TABLE transactions ADD COLUMN balance_before DECIMAL(10,2);
                        END IF;

                        -- Add balance_after
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'balance_after') THEN
                            ALTER TABLE transactions ADD COLUMN balance_after DECIMAL(10,2);
                        END IF;

                        -- Add source (default web)
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'source') THEN
                            ALTER TABLE transactions ADD COLUMN source VARCHAR(20) DEFAULT 'web';
                        END IF;

                        -- Add paid (default no)
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'paid') THEN
                            ALTER TABLE transactions ADD COLUMN paid VARCHAR(10) DEFAULT 'no';
                        END IF;

                        -- Add source_provider (default datahouse)
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'source_provider') THEN
                            ALTER TABLE transactions ADD COLUMN source_provider VARCHAR(50) DEFAULT 'datahouse';
                        END IF;

                        -- Add provider_slug to data_bundles
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'data_bundles' AND column_name = 'provider_slug') THEN
                            ALTER TABLE data_bundles ADD COLUMN provider_slug VARCHAR(50) DEFAULT NULL;
                        END IF;
                    END $$;
                `);
                console.log('✅ Altered transactions and data_bundles tables with redesign columns');
            } catch (txAlterErr) {
                console.error('⚠️ transactions table redesign alter error:', txAlterErr.message);
            }

            console.log('✅ Reseller Platform tables checked/created');

            // Agent Store & Reseller Marketplace Tables
            console.log('🛠️ Checking/Creating Agent Store & Reseller Marketplace tables...');
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS agent_stores (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
                    store_name VARCHAR(255) NOT NULL,
                    slug VARCHAR(255) UNIQUE NOT NULL,
                    description TEXT,
                    phone VARCHAR(20) NOT NULL,
                    logo_url TEXT,
                    review_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
                    activation_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
                    admin_notes TEXT,
                    is_visible BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `).catch(err => console.log('Info: agent_stores check:', err.message));

            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_agent_stores_user ON agent_stores(user_id)`).catch(() => {});
            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_agent_stores_slug ON agent_stores(slug)`).catch(() => {});
            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_agent_stores_review ON agent_stores(review_status)`).catch(() => {});
            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_agent_stores_activation ON agent_stores(activation_status)`).catch(() => {});

            await pool.execute(`
                CREATE TABLE IF NOT EXISTS agent_store_activation_payments (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    store_id UUID NOT NULL REFERENCES agent_stores(id) ON DELETE CASCADE,
                    user_id UUID NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
                    amount_ghc DECIMAL(10,2) NOT NULL DEFAULT 100.00,
                    paystack_reference VARCHAR(255) UNIQUE NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    paid_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `).catch(err => console.log('Info: agent_store_activation_payments check:', err.message));

            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_activation_payments_store ON agent_store_activation_payments(store_id)`).catch(() => {});
            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_activation_payments_ref ON agent_store_activation_payments(paystack_reference)`).catch(() => {});

            await pool.execute(`
                CREATE TABLE IF NOT EXISTS agent_store_products (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    store_id UUID NOT NULL REFERENCES agent_stores(id) ON DELETE CASCADE,
                    bundle_id UUID NOT NULL REFERENCES data_bundles(id) ON DELETE CASCADE,
                    agent_price_ghc DECIMAL(10,2) NOT NULL,
                    is_enabled BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(store_id, bundle_id)
                )
            `).catch(err => console.log('Info: agent_store_products check:', err.message));

            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_agent_products_store ON agent_store_products(store_id)`).catch(() => {});
            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_agent_products_bundle ON agent_store_products(bundle_id)`).catch(() => {});

            await pool.execute(`
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
                    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `).catch(err => console.log('Info: agent_orders check:', err.message));

            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_agent_orders_store ON agent_orders(store_id)`).catch(() => {});
            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_agent_orders_agent ON agent_orders(agent_id)`).catch(() => {});
            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_agent_orders_paystack ON agent_orders(paystack_reference)`).catch(() => {});

            await pool.execute(`
                CREATE TABLE IF NOT EXISTS agent_wallets (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    agent_id UUID UNIQUE NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
                    available_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    pending_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    total_profit_earned DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    total_withdrawn DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `).catch(err => console.log('Info: agent_wallets check:', err.message));

            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_agent_wallets_agent ON agent_wallets(agent_id)`).catch(() => {});

            await pool.execute(`
                CREATE TABLE IF NOT EXISTS agent_wallet_ledger (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    agent_id UUID NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
                    store_id UUID REFERENCES agent_stores(id) ON DELETE SET NULL,
                    order_id UUID REFERENCES agent_orders(id) ON DELETE SET NULL,
                    type VARCHAR(30) NOT NULL,
                    amount_ghc DECIMAL(10,2) NOT NULL,
                    balance_after DECIMAL(10,2) NOT NULL,
                    description TEXT,
                    reference VARCHAR(255),
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `).catch(err => console.log('Info: agent_wallet_ledger check:', err.message));

            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_agent_ledger_agent ON agent_wallet_ledger(agent_id)`).catch(() => {});

            await pool.execute(`
                CREATE TABLE IF NOT EXISTS agent_withdrawals (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    agent_id UUID NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
                    store_id UUID REFERENCES agent_stores(id) ON DELETE SET NULL,
                    amount_ghc DECIMAL(10,2) NOT NULL,
                    payment_method VARCHAR(50) NOT NULL DEFAULT 'momo',
                    account_number VARCHAR(50) NOT NULL,
                    account_name VARCHAR(255) NOT NULL,
                    bank_momo_provider VARCHAR(50) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
                    admin_notes TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `).catch(err => console.log('Info: agent_withdrawals check:', err.message));

            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_agent_withdrawals_agent ON agent_withdrawals(agent_id)`).catch(() => {});
            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_agent_withdrawals_status ON agent_withdrawals(status)`).catch(() => {});

            await pool.execute(`
                CREATE TABLE IF NOT EXISTS agent_pricing_rules (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    min_markup_ghc DECIMAL(10,2) NOT NULL DEFAULT 0.50,
                    max_markup_ghc DECIMAL(10,2) NOT NULL DEFAULT 50.00,
                    min_withdrawal_ghc DECIMAL(10,2) NOT NULL DEFAULT 20.00,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `).catch(err => console.log('Info: agent_pricing_rules check:', err.message));

            // Create mtn_beneficiary_approvals table
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS mtn_beneficiary_approvals (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    msisdn VARCHAR(20) UNIQUE NOT NULL,
                    display_phone VARCHAR(20) NOT NULL,
                    network VARCHAR(20) DEFAULT 'MTN',
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    occurrences INT NOT NULL DEFAULT 1,
                    bundle_sizes JSONB DEFAULT '[]'::jsonb,
                    sources JSONB DEFAULT '[]'::jsonb,
                    first_detected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    last_detected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    submitted_at TIMESTAMPTZ,
                    approved_at TIMESTAMPTZ,
                    rejected_at TIMESTAMPTZ,
                    resolved_at TIMESTAMPTZ
                )
            `).catch(err => console.log('Info: mtn_beneficiary_approvals check:', err.message));

            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_mtn_approvals_msisdn ON mtn_beneficiary_approvals(msisdn)`).catch(() => {});
            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_mtn_approvals_status ON mtn_beneficiary_approvals(status)`).catch(() => {});

            // Create mtn_beneficiary_approval_orders junction table
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS mtn_beneficiary_approval_orders (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    approval_id UUID NOT NULL REFERENCES mtn_beneficiary_approvals(id) ON DELETE CASCADE,
                    order_id UUID,
                    order_reference VARCHAR(100) NOT NULL,
                    bundle_size VARCHAR(20) NOT NULL,
                    source VARCHAR(50) NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `).catch(err => console.log('Info: mtn_beneficiary_approval_orders check:', err.message));

            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_mtn_approval_orders_approval ON mtn_beneficiary_approval_orders(approval_id)`).catch(() => {});
            await pool.execute(`CREATE INDEX IF NOT EXISTS idx_mtn_approval_orders_ref ON mtn_beneficiary_approval_orders(order_reference)`).catch(() => {});

            // Seed default pricing rules if table empty
            const [rules] = await pool.execute('SELECT COUNT(*)::integer as count FROM agent_pricing_rules');
            if (rules[0]?.count === 0) {
                await pool.execute(`
                    INSERT INTO agent_pricing_rules (min_markup_ghc, max_markup_ghc, min_withdrawal_ghc)
                    VALUES (0.50, 50.00, 20.00)
                `);
                console.log('✅ Seeded default Agent Store pricing rules');
            }

            // Migrate existing confirmed refunded orders to 'refunded' status
            console.log('🛠️ Migrating historical confirmed refunded records...');
            await pool.execute(`
                UPDATE transactions SET status = 'refunded' WHERE paid = 'refunded' AND status = 'failed';
            `).catch(() => {});
            await pool.execute(`
                UPDATE agent_orders SET fulfillment_status = 'refunded', payment_status = 'refunded' WHERE payment_status = 'refunded';
            `).catch(() => {});
            console.log('✅ Migrated historical confirmed refunded records');

            console.log('✅ Agent Store & Reseller Marketplace tables initialized successfully');
        } catch (colErr) {
            console.error('⚠️ Migration error:', colErr.message);
        }

        console.log('✅ Database tables initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Error initializing database tables:', error.message);
        // Don't throw - let the server continue even if this fails
        return false;
    }
};

module.exports = { initializeTables };
