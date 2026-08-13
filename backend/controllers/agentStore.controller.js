const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { placeDataOrder } = require('../utils/sourcing');
const { logActivity } = require('../utils/activityLogger');
const { sendExportResponse } = require('../utils/exportHelper');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Helper: Slugify store name
const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
};

// Helper: Derive effective store status
const deriveEffectiveStatus = (reviewStatus, activationStatus, isVisible = true) => {
    if (isVisible === false) return 'INACTIVE';
    if (reviewStatus === 'SUSPENDED') return 'SUSPENDED';
    if (reviewStatus === 'REJECTED') return 'REJECTED';
    if (reviewStatus === 'CHANGES_REQUESTED') return 'CHANGES_REQUESTED';
    if (reviewStatus === 'PENDING_REVIEW') return 'PENDING';
    if (reviewStatus === 'APPROVED' && activationStatus === 'PAID') return 'ACTIVE';
    if (reviewStatus === 'APPROVED' && activationStatus !== 'PAID') return 'APPROVED';
    return 'PENDING';
};

// 1. CREATE STORE
exports.createStore = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;
        let { store_name, description, phone, logo_url } = req.body;

        if (!store_name || !phone) {
            return res.status(400).json({ success: false, error: 'Store name and phone number are required' });
        }

        // INPUT VALIDATION & SANITIZATION
        store_name = String(store_name).trim();
        phone = String(phone).trim();
        description = description ? String(description).trim() : '';
        logo_url = logo_url ? String(logo_url).trim() : '';

        if (store_name.length < 3 || store_name.length > 60) {
            return res.status(400).json({ success: false, error: 'Store name must be between 3 and 60 characters.' });
        }
        if (description.length > 500) {
            return res.status(400).json({ success: false, error: 'Description cannot exceed 500 characters.' });
        }
        if (phone.length < 9 || phone.length > 15) {
            return res.status(400).json({ success: false, error: 'Invalid phone number format.' });
        }

        // Check if user already has a store
        const [existingStores] = await connection.execute(
            'SELECT id, store_name, slug, review_status, activation_status FROM agent_stores WHERE user_id = ?::uuid',
            [userId]
        );

        if (existingStores.length > 0) {
            const store = existingStores[0];
            const status = deriveEffectiveStatus(store.review_status, store.activation_status);
            return res.status(400).json({
                success: false,
                error: 'You already have an Agent Store created.',
                store,
                effective_status: status
            });
        }

        // Generate slug
        let baseSlug = slugify(store_name);
        if (!baseSlug) baseSlug = 'agent-store-' + Math.floor(1000 + Math.random() * 9000);
        let slug = baseSlug;

        // Ensure unique slug
        const [existingSlugs] = await connection.execute('SELECT id FROM agent_stores WHERE slug = ?', [slug]);
        if (existingSlugs.length > 0) {
            slug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;
        }

        const storeId = uuidv4();

        // Create store
        await connection.execute(
            `INSERT INTO agent_stores (id, user_id, store_name, slug, description, phone, logo_url, review_status, activation_status, created_at, updated_at)
             VALUES (?::uuid, ?::uuid, ?, ?, ?, ?, ?, 'PENDING_REVIEW', 'UNPAID', NOW(), NOW())`,
            [storeId, userId, store_name, slug, description || '', phone, logo_url || '']
        );

        // Ensure wallet exists for user
        await connection.execute(
            `INSERT INTO agent_wallets (id, agent_id, available_balance, pending_balance, total_profit_earned, total_withdrawn, created_at, updated_at)
             VALUES (?::uuid, ?::uuid, 0.00, 0.00, 0.00, 0.00, NOW(), NOW())
             ON CONFLICT (agent_id) DO NOTHING`,
            [uuidv4(), userId]
        );

        // Create notification for user
        await connection.execute(
            `INSERT INTO notifications (id, user_id, title, message, type, created_at)
             VALUES (?::uuid, ?::uuid, ?, ?, 'info', NOW())`,
            [
                uuidv4(),
                userId,
                'Agent Store Created',
                `Your Agent Store "${store_name}" has been created and submitted for administrative review.`
            ]
        );

        const effectiveStatus = deriveEffectiveStatus('PENDING_REVIEW', 'UNPAID');

        // Log activity (non-blocking)
        logActivity(userId, 'AGENT_STORE_CREATED', `Created Agent Store "${store_name}" (slug: ${slug})`, { storeId, store_name, slug, phone }, req.ip);

        res.json({
            success: true,
            message: 'Agent Store submitted successfully',
            store: {
                id: storeId,
                store_name,
                slug,
                description,
                phone,
                logo_url,
                review_status: 'PENDING_REVIEW',
                activation_status: 'UNPAID',
                effective_status: effectiveStatus,
                activation_fee_ghc: 100.00
            }
        });
    } catch (error) {
        console.error('Error creating agent store:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to create Agent Store' });
    } finally {
        if (connection) connection.release();
    }
};

// 2. GET MY STORE
exports.getMyStore = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;

        const [stores] = await connection.execute(
            `SELECT s.*, 
                    COALESCE(w.available_balance, 0.00) as available_balance,
                    COALESCE(w.pending_balance, 0.00) as pending_balance,
                    COALESCE(w.total_profit_earned, 0.00) as total_profit_earned,
                    COALESCE(w.total_withdrawn, 0.00) as total_withdrawn
             FROM agent_stores s
             LEFT JOIN agent_wallets w ON s.user_id = w.agent_id
             WHERE s.user_id = ?::uuid`,
            [userId]
        );

        if (stores.length === 0) {
            return res.json({ success: true, hasStore: false, store: null });
        }

        const store = stores[0];
        store.effective_status = deriveEffectiveStatus(store.review_status, store.activation_status);

        // Get pricing rules
        const [rules] = await connection.execute('SELECT * FROM agent_pricing_rules LIMIT 1');
        const pricingRules = rules[0] || { min_markup_ghc: 0.50, max_markup_ghc: 50.00, min_withdrawal_ghc: 20.00 };

        res.json({
            success: true,
            hasStore: true,
            store,
            pricingRules
        });
    } catch (error) {
        console.error('Error getting my store:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve Agent Store' });
    } finally {
        if (connection) connection.release();
    }
};

// 3. UPDATE STORE SETTINGS
exports.updateStoreSettings = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;
        const { store_name, description, phone, logo_url, is_visible } = req.body;

        const [stores] = await connection.execute('SELECT id FROM agent_stores WHERE user_id = ?::uuid', [userId]);

        if (stores.length === 0) {
            return res.status(404).json({ success: false, error: 'Store not found' });
        }

        const storeId = stores[0].id;
        const cleanLogoUrl = logo_url !== undefined ? String(logo_url || '').trim() : null;

        await connection.execute(
            `UPDATE agent_stores 
             SET store_name = COALESCE(?, store_name),
                 description = COALESCE(?, description),
                 phone = COALESCE(?, phone),
                 logo_url = CASE WHEN ?::text IS NOT NULL THEN ?::text ELSE logo_url END,
                 is_visible = COALESCE(?, is_visible),
                 updated_at = NOW()
             WHERE id = ?::uuid`,
            [store_name, description, phone, cleanLogoUrl, cleanLogoUrl, is_visible, storeId]
        );

        // Log activity (non-blocking)
        logActivity(userId, 'AGENT_STORE_SETTINGS_UPDATED', `Updated Agent Store settings`, { storeId, store_name, phone, is_visible }, req.ip);

        res.json({ success: true, message: 'Store settings updated successfully' });
    } catch (error) {
        console.error('Error updating store settings:', error);
        res.status(500).json({ success: false, error: 'Failed to update store settings' });
    } finally {
        if (connection) connection.release();
    }
};

// 4. INITIALIZE ACTIVATION PAYMENT (GHS 100)
exports.initializeActivationPayment = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;
        const { callbackUrl } = req.body;

        const [stores] = await connection.execute(
            'SELECT id, store_name, activation_status FROM agent_stores WHERE user_id = ?::uuid',
            [userId]
        );

        if (stores.length === 0) {
            return res.status(404).json({ success: false, error: 'Agent Store not found. Create a store first.' });
        }

        const store = stores[0];

        if (store.activation_status === 'PAID') {
            return res.status(400).json({ success: false, error: 'Activation fee of GHS 100 has already been paid.' });
        }

        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!paystackSecretKey) {
            return res.status(500).json({ success: false, error: 'Payment service not configured' });
        }

        const userEmail = req.user.email;
        const amountGhc = 100.00;
        const reference = `ACT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const resolvedCallbackUrl = callbackUrl || `${process.env.FRONTEND_URL}/dashboard/agent-store?activated=true`;

        // Initialize Paystack payment
        const paystackResponse = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: userEmail,
                amount: 10000, // GHS 100 in pesewas
                currency: 'GHS',
                reference,
                callback_url: resolvedCallbackUrl,
                metadata: {
                    type: 'AGENT_STORE_ACTIVATION',
                    store_id: store.id,
                    user_id: userId,
                    store_name: store.store_name
                },
            }),
        });

        const paystackData = await paystackResponse.json();

        if (!paystackData.status || !paystackData.data) {
            return res.status(400).json({
                success: false,
                error: paystackData.message || 'Failed to initialize activation payment'
            });
        }

        // Record activation payment in database
        await connection.execute(
            `INSERT INTO agent_store_activation_payments (id, store_id, user_id, amount_ghc, paystack_reference, status, created_at)
             VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?, 'pending', NOW())
             ON CONFLICT (paystack_reference) DO NOTHING`,
            [uuidv4(), store.id, userId, amountGhc, reference]
        );

        res.json({
            success: true,
            authorization_url: paystackData.data.authorization_url,
            reference,
            amount_ghc: amountGhc
        });
    } catch (error) {
        console.error('Error initializing activation payment:', error);
        res.status(500).json({ success: false, error: 'Activation payment initialization failed' });
    } finally {
        if (connection) connection.release();
    }
};

// 5. VERIFY ACTIVATION PAYMENT
exports.verifyActivationPayment = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { reference } = req.body;
        const userId = req.user.id;

        if (!reference) {
            return res.status(400).json({ success: false, error: 'Missing payment reference' });
        }

        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!paystackSecretKey) {
            return res.status(500).json({ success: false, error: 'Payment service not configured' });
        }

        // Verify with Paystack
        const verifyResponse = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
            headers: { 'Authorization': `Bearer ${paystackSecretKey}` },
        });

        const verifyData = await verifyResponse.json();

        if (!verifyData.status || !verifyData.data || verifyData.data.status !== 'success') {
            return res.status(400).json({ success: false, error: 'Payment verification failed or unpaid.' });
        }

        // SECURITY: Verify currency and amount matches GHS 100 (10000 pesewas)
        if (verifyData.data.currency !== 'GHS' || verifyData.data.amount !== 10000) {
            console.error(`🚨 Security Alert: Activation payment amount/currency mismatch for user ${userId}. Expected: 10000 GHS pesewas, Received: ${verifyData.data.amount} ${verifyData.data.currency}`);
            return res.status(400).json({ success: false, error: 'Activation payment verification failed: Amount or currency mismatch' });
        }

        const [stores] = await connection.execute('SELECT * FROM agent_stores WHERE user_id = ?::uuid', [userId]);

        if (stores.length === 0) {
            return res.status(404).json({ success: false, error: 'Store not found' });
        }

        const store = stores[0];

        // Update activation payment record
        await connection.execute(
            `UPDATE agent_store_activation_payments 
             SET status = 'completed', paid_at = NOW() 
             WHERE paystack_reference = ?`,
            [reference]
        );

        // Mark store as paid
        await connection.execute(
            `UPDATE agent_stores 
             SET activation_status = 'PAID', updated_at = NOW() 
             WHERE id = ?::uuid`,
            [store.id]
        );

        const updatedEffectiveStatus = deriveEffectiveStatus(store.review_status, 'PAID');

        res.json({
            success: true,
            message: 'Activation payment verified successfully!',
            activation_status: 'PAID',
            effective_status: updatedEffectiveStatus
        });
    } catch (error) {
        console.error('Error verifying activation payment:', error);
        res.status(500).json({ success: false, error: 'Activation verification failed' });
    } finally {
        if (connection) connection.release();
    }
};

// 6. GET STORE PRODUCTS
exports.getStoreProducts = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;

        const [stores] = await connection.execute('SELECT id FROM agent_stores WHERE user_id = ?::uuid', [userId]);

        if (stores.length === 0) {
            return res.status(404).json({ success: false, error: 'Agent Store not found' });
        }

        const storeId = stores[0].id;

        // Fetch pricing rules
        const [rules] = await connection.execute('SELECT * FROM agent_pricing_rules LIMIT 1');
        const minMarkup = parseFloat(rules[0]?.min_markup_ghc || 0.50);
        const maxMarkup = parseFloat(rules[0]?.max_markup_ghc || 50.00);

        // Fetch all active data bundles and join with agent's custom prices
        const [bundles] = await connection.execute(
            `SELECT b.id as bundle_id, b.network, b.data_amount, b.price_ghc as base_price_ghc,
                    ap.id as agent_product_id,
                    COALESCE(ap.agent_price_ghc, b.price_ghc + ?) as agent_price_ghc,
                    COALESCE(ap.is_enabled, TRUE) as is_enabled
             FROM data_bundles b
             LEFT JOIN agent_store_products ap ON b.id = ap.bundle_id AND ap.store_id = ?::uuid
             WHERE b.is_active = TRUE
             ORDER BY b.network ASC, b.price_ghc ASC`,
            [minMarkup, storeId]
        );

        // Add calculated profit
        const products = bundles.map(b => {
            const base = parseFloat(b.base_price_ghc);
            const agentPrice = parseFloat(b.agent_price_ghc);
            const profit = Math.max(0, agentPrice - base);

            return {
                bundle_id: b.bundle_id,
                network: b.network,
                data_amount: b.data_amount,
                base_price_ghc: base,
                agent_price_ghc: agentPrice,
                profit_ghc: profit,
                is_enabled: Boolean(b.is_enabled),
                is_added: Boolean(b.agent_product_id)
            };
        });

        res.json({
            success: true,
            products,
            pricingRules: {
                min_markup_ghc: minMarkup,
                max_markup_ghc: maxMarkup
            }
        });
    } catch (error) {
        console.error('Error getting store products:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve products' });
    } finally {
        if (connection) connection.release();
    }
};

// 7. UPDATE STORE PRODUCTS / PRICES
exports.updateStoreProducts = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;
        const { products } = req.body; // Array of { bundle_id, agent_price_ghc, is_enabled }

        if (!Array.isArray(products)) {
            return res.status(400).json({ success: false, error: 'Invalid products array' });
        }

        const [stores] = await connection.execute('SELECT id FROM agent_stores WHERE user_id = ?::uuid', [userId]);

        if (stores.length === 0) {
            return res.status(404).json({ success: false, error: 'Agent Store not found' });
        }

        const storeId = stores[0].id;

        // Fetch pricing rules
        const [rules] = await connection.execute('SELECT * FROM agent_pricing_rules LIMIT 1');
        const minMarkup = parseFloat(rules[0]?.min_markup_ghc || 0.50);
        const maxMarkup = parseFloat(rules[0]?.max_markup_ghc || 50.00);

        // Validate all prices against base prices and limits
        for (const item of products) {
            const [bundleRows] = await connection.execute(
                'SELECT price_ghc FROM data_bundles WHERE id = ?::uuid',
                [item.bundle_id]
            );

            if (bundleRows.length > 0) {
                const basePrice = parseFloat(bundleRows[0].price_ghc);
                const agentPrice = parseFloat(item.agent_price_ghc);

                if (agentPrice < basePrice + minMarkup) {
                    return res.status(400).json({
                        success: false,
                        error: `Selling price for bundle cannot be lower than GHS ${(basePrice + minMarkup).toFixed(2)} (Base: GHS ${basePrice.toFixed(2)} + Min Markup: GHS ${minMarkup.toFixed(2)})`
                    });
                }

                if (agentPrice > basePrice + maxMarkup) {
                    return res.status(400).json({
                        success: false,
                        error: `Selling price exceeds maximum allowed markup of GHS ${maxMarkup.toFixed(2)} above base price.`
                    });
                }
            }
        }

        // Upsert into agent_store_products
        for (const item of products) {
            const productId = uuidv4();
            await connection.execute(
                `INSERT INTO agent_store_products (id, store_id, bundle_id, agent_price_ghc, is_enabled, created_at, updated_at)
                 VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?, NOW(), NOW())
                 ON CONFLICT (store_id, bundle_id)
                 DO UPDATE SET agent_price_ghc = EXCLUDED.agent_price_ghc,
                               is_enabled = EXCLUDED.is_enabled,
                               updated_at = NOW()`,
                [productId, storeId, item.bundle_id, item.agent_price_ghc, item.is_enabled]
            );
        }

        // Log activity (non-blocking)
        logActivity(userId, 'AGENT_STORE_PRICES_UPDATED', `Updated pricing for ${products.length} store product(s)`, { storeId, productCount: products.length }, req.ip);

        res.json({ success: true, message: 'Products and prices updated successfully!' });
    } catch (error) {
        console.error('Error updating store products:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to update store products' });
    } finally {
        if (connection) connection.release();
    }
};

// 7b. DELETE / UNLINK STORE PRODUCT
exports.deleteStoreProduct = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;
        const { bundleId } = req.params;

        const [stores] = await connection.execute('SELECT id FROM agent_stores WHERE user_id = ?::uuid', [userId]);

        if (stores.length === 0) {
            return res.status(404).json({ success: false, error: 'Agent Store not found' });
        }

        const storeId = stores[0].id;

        await connection.execute(
            'DELETE FROM agent_store_products WHERE store_id = ?::uuid AND bundle_id = ?::uuid',
            [storeId, bundleId]
        );

        logActivity(userId, 'AGENT_PRODUCT_REMOVED', `Removed data bundle product from Agent Store`, { storeId, bundleId }, req.ip);

        res.json({ success: true, message: 'Product removed from store successfully!' });
    } catch (error) {
        console.error('Error removing store product:', error);
        res.status(500).json({ success: false, error: 'Failed to remove store product' });
    } finally {
        if (connection) connection.release();
    }
};

// 7c. ADD SINGLE DATA BUNDLE PRODUCT TO STORE
exports.addStoreProduct = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;
        const { bundle_id, agent_price_ghc, is_enabled } = req.body;

        if (!bundle_id) {
            return res.status(400).json({ success: false, error: 'Data bundle plan is required.' });
        }

        const [stores] = await connection.execute('SELECT id FROM agent_stores WHERE user_id = ?::uuid', [userId]);
        if (stores.length === 0) {
            return res.status(404).json({ success: false, error: 'Agent Store not found' });
        }
        const storeId = stores[0].id;

        // Fetch target bundle and check if active
        const [bundleRows] = await connection.execute(
            'SELECT id, network, data_amount, price_ghc, is_active FROM data_bundles WHERE id = ?::uuid',
            [bundle_id]
        );

        if (bundleRows.length === 0 || !bundleRows[0].is_active) {
            return res.status(400).json({
                success: false,
                error: 'This data bundle plan is currently unavailable or disabled by Administrator.'
            });
        }

        const bundle = bundleRows[0];
        const basePrice = parseFloat(bundle.price_ghc);

        // Fetch pricing rules
        const [rules] = await connection.execute('SELECT * FROM agent_pricing_rules LIMIT 1');
        const minMarkup = parseFloat(rules[0]?.min_markup_ghc || 0.50);
        const maxMarkup = parseFloat(rules[0]?.max_markup_ghc || 50.00);

        const priceNum = parseFloat(agent_price_ghc);
        const targetSellingPrice = isNaN(priceNum) || priceNum <= 0 ? (basePrice + minMarkup) : priceNum;

        if (targetSellingPrice < basePrice + minMarkup) {
            return res.status(400).json({
                success: false,
                error: `Selling price for ${bundle.network} ${bundle.data_amount} cannot be lower than GHS ${(basePrice + minMarkup).toFixed(2)} (Base: GHS ${basePrice.toFixed(2)} + Min Markup: GHS ${minMarkup.toFixed(2)})`
            });
        }

        if (targetSellingPrice > basePrice + maxMarkup) {
            return res.status(400).json({
                success: false,
                error: `Selling price exceeds maximum allowed markup of GHS ${maxMarkup.toFixed(2)} above base price.`
            });
        }

        const productId = uuidv4();
        const enabledStatus = is_enabled !== undefined ? Boolean(is_enabled) : true;

        await connection.execute(
            `INSERT INTO agent_store_products (id, store_id, bundle_id, agent_price_ghc, is_enabled, created_at, updated_at)
             VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?, NOW(), NOW())
             ON CONFLICT (store_id, bundle_id)
             DO UPDATE SET agent_price_ghc = EXCLUDED.agent_price_ghc,
                           is_enabled = EXCLUDED.is_enabled,
                           updated_at = NOW()`,
            [productId, storeId, bundle_id, targetSellingPrice, enabledStatus]
        );

        logActivity(userId, 'AGENT_PRODUCT_ADDED', `Added ${bundle.network} ${bundle.data_amount} to Agent Store`, { storeId, bundle_id, targetSellingPrice }, req.ip);

        res.json({
            success: true,
            message: `Successfully added ${bundle.network} ${bundle.data_amount} to your Agent Store!`,
            product: {
                bundle_id,
                network: bundle.network,
                data_amount: bundle.data_amount,
                base_price_ghc: basePrice,
                agent_price_ghc: targetSellingPrice,
                profit_ghc: targetSellingPrice - basePrice,
                is_enabled: enabledStatus,
                is_added: true
            }
        });
    } catch (error) {
        console.error('Error adding store product:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to add data bundle to store' });
    } finally {
        if (connection) connection.release();
    }
};

// 8. GET DASHBOARD STATS
exports.getDashboardStats = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;

        const [stores] = await connection.execute(
            `SELECT s.*, 
                    COALESCE(w.available_balance, 0.00) as available_balance,
                    COALESCE(w.pending_balance, 0.00) as pending_balance,
                    COALESCE(w.total_profit_earned, 0.00) as total_profit_earned,
                    COALESCE(w.total_withdrawn, 0.00) as total_withdrawn
             FROM agent_stores s
             LEFT JOIN agent_wallets w ON s.user_id = w.agent_id
             WHERE s.user_id = ?::uuid`,
            [userId]
        );

        if (stores.length === 0) {
            return res.status(404).json({ success: false, error: 'Agent Store not found' });
        }

        const store = stores[0];
        store.effective_status = deriveEffectiveStatus(store.review_status, store.activation_status);

        // Sales Metrics
        const [salesStats] = await connection.execute(
            `SELECT 
                COUNT(*)::integer as total_orders,
                COALESCE(SUM(CASE WHEN fulfillment_status = 'completed' THEN selling_price_ghc ELSE 0 END), 0.00) as total_sales_ghc,
                COALESCE(SUM(CASE WHEN fulfillment_status = 'completed' THEN profit_ghc ELSE 0 END), 0.00) as total_profit_ghc,
                COUNT(CASE WHEN fulfillment_status = 'completed' THEN 1 END)::integer as successful_orders,
                COUNT(CASE WHEN fulfillment_status = 'failed' THEN 1 END)::integer as failed_orders,
                COUNT(CASE WHEN fulfillment_status IN ('pending', 'processing') THEN 1 END)::integer as pending_orders
             FROM agent_orders
             WHERE store_id = ?::uuid`,
            [store.id]
        );

        // Best performing network
        const [networkStats] = await connection.execute(
            `SELECT network, COUNT(*)::integer as order_count, SUM(profit_ghc) as profit
             FROM agent_orders
             WHERE store_id = ?::uuid AND fulfillment_status = 'completed'
             GROUP BY network
             ORDER BY profit DESC
             LIMIT 1`,
            [store.id]
        );

        // Best selling product
        const [productStats] = await connection.execute(
            `SELECT data_amount, network, COUNT(*)::integer as sales_count
             FROM agent_orders
             WHERE store_id = ?::uuid AND fulfillment_status = 'completed'
             GROUP BY data_amount, network
             ORDER BY sales_count DESC
             LIMIT 1`,
            [store.id]
        );

        // Recent orders (last 5)
        const [recentOrders] = await connection.execute(
            `SELECT id, customer_phone, network, data_amount, selling_price_ghc, profit_ghc, fulfillment_status, created_at
             FROM agent_orders
             WHERE store_id = ?::uuid AND fulfillment_status != 'pending_mtn_approval'
             ORDER BY created_at DESC
             LIMIT 5`,
            [store.id]
        );

        res.json({
            success: true,
            store,
            financials: {
                total_sales_ghc: parseFloat(salesStats[0].total_sales_ghc),
                total_profit_earned: parseFloat(store.total_profit_earned),
                available_balance: parseFloat(store.available_balance),
                pending_balance: parseFloat(store.pending_balance),
                total_withdrawn: parseFloat(store.total_withdrawn)
            },
            orders: {
                total: salesStats[0].total_orders,
                successful: salesStats[0].successful_orders,
                failed: salesStats[0].failed_orders,
                pending: salesStats[0].pending_orders
            },
            insights: {
                best_network: networkStats[0]?.network || 'N/A',
                best_product: productStats[0] ? `${productStats[0].network} ${productStats[0].data_amount}` : 'N/A',
                best_product_count: productStats[0]?.sales_count || 0
            },
            recentOrders
        });
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch dashboard statistics' });
    } finally {
        if (connection) connection.release();
    }
};

// 9. GET AGENT ORDERS
exports.getAgentOrders = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;
        const { status, network, search } = req.query;

        const [stores] = await connection.execute('SELECT id FROM agent_stores WHERE user_id = ?::uuid', [userId]);
        if (stores.length === 0) return res.status(404).json({ success: false, error: 'Store not found' });
        const storeId = stores[0].id;

        let query = `
            SELECT id, customer_phone, network, data_amount, base_price_ghc, selling_price_ghc, profit_ghc,
                   paystack_reference, payment_status, fulfillment_status, created_at
            FROM agent_orders
            WHERE store_id = ?::uuid AND fulfillment_status != 'pending_mtn_approval'
        `;
        const params = [storeId];

        if (status) {
            query += ` AND fulfillment_status = ?`;
            params.push(status);
        }
        if (network) {
            query += ` AND network = ?`;
            params.push(network);
        }
        if (search) {
            query += ` AND (customer_phone LIKE ? OR id::text LIKE ? OR paystack_reference LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        query += ` ORDER BY created_at DESC LIMIT 100`;

        const [orders] = await connection.execute(query, params);

        res.json({ success: true, orders });
    } catch (error) {
        console.error('Error getting agent orders:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve orders' });
    } finally {
        if (connection) connection.release();
    }
};

// 10. GET AGENT TRANSACTIONS / LEDGER
exports.getAgentTransactions = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;

        const [ledger] = await connection.execute(
            `SELECT id, type, amount_ghc, balance_after, description, reference, created_at
             FROM agent_wallet_ledger
             WHERE agent_id = ?::uuid
             ORDER BY created_at DESC
             LIMIT 100`,
            [userId]
        );

        res.json({ success: true, ledger });
    } catch (error) {
        console.error('Error getting agent transactions:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve financial transactions' });
    } finally {
        if (connection) connection.release();
    }
};

// 11. GET AGENT CUSTOMERS
exports.getAgentCustomers = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;

        const [stores] = await connection.execute('SELECT id FROM agent_stores WHERE user_id = ?::uuid', [userId]);
        if (stores.length === 0) return res.status(404).json({ success: false, error: 'Store not found' });

        const [customers] = await connection.execute(
            `SELECT customer_phone,
                    COUNT(*)::integer as total_orders,
                    SUM(CASE WHEN fulfillment_status = 'completed' THEN selling_price_ghc ELSE 0 END) as total_spent_ghc,
                    MAX(created_at) as last_purchase_at
             FROM agent_orders
             WHERE store_id = ?::uuid
             GROUP BY customer_phone
             ORDER BY total_spent_ghc DESC
             LIMIT 100`,
            [stores[0].id]
        );

        res.json({ success: true, customers });
    } catch (error) {
        console.error('Error getting agent customers:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve store customers' });
    } finally {
        if (connection) connection.release();
    }
};

// 12. GET AGENT ANALYTICS
exports.getAgentAnalytics = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;

        const [stores] = await connection.execute('SELECT id FROM agent_stores WHERE user_id = ?::uuid', [userId]);
        if (stores.length === 0) return res.status(404).json({ success: false, error: 'Store not found' });
        const storeId = stores[0].id;

        // Daily profit & sales last 14 days
        const [dailyStats] = await connection.execute(
            `SELECT DATE(created_at) as date,
                    COUNT(*)::integer as orders,
                    SUM(selling_price_ghc) as sales,
                    SUM(profit_ghc) as profit
             FROM agent_orders
             WHERE store_id = ?::uuid AND fulfillment_status = 'completed'
             GROUP BY DATE(created_at)
             ORDER BY date ASC
             LIMIT 14`,
            [storeId]
        );

        // Network share
        const [networkShare] = await connection.execute(
            `SELECT network, COUNT(*)::integer as count, SUM(profit_ghc) as total_profit
             FROM agent_orders
             WHERE store_id = ?::uuid AND fulfillment_status = 'completed'
             GROUP BY network`,
            [storeId]
        );

        res.json({ success: true, dailyStats, networkShare });
    } catch (error) {
        console.error('Error getting agent analytics:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve analytics' });
    } finally {
        if (connection) connection.release();
    }
};

// 13. REQUEST WITHDRAWAL
exports.requestWithdrawal = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;
        const { amount_ghc, payment_method, account_number, account_name, bank_momo_provider } = req.body;

        const amount = parseFloat(amount_ghc);
        if (!amount || amount <= 0 || !account_number || !account_name || !bank_momo_provider) {
            return res.status(400).json({ success: false, error: 'All withdrawal fields are required' });
        }

        // Get minimum withdrawal rule
        const [rules] = await connection.execute('SELECT min_withdrawal_ghc FROM agent_pricing_rules LIMIT 1');
        const minWithdrawal = parseFloat(rules[0]?.min_withdrawal_ghc || 20.00);

        if (amount < minWithdrawal) {
            return res.status(400).json({ success: false, error: `Minimum withdrawal amount is GHS ${minWithdrawal.toFixed(2)}` });
        }

        await connection.beginTransaction();

        // FOR UPDATE lock prevents concurrent withdrawal race conditions
        const [wallets] = await connection.execute(
            'SELECT available_balance FROM agent_wallets WHERE agent_id = ?::uuid FOR UPDATE',
            [userId]
        );
        if (wallets.length === 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, error: 'Wallet not found' });
        }

        const currentBalance = parseFloat(wallets[0].available_balance);

        if (currentBalance < amount) {
            await connection.rollback();
            return res.status(400).json({ success: false, error: `Insufficient profit balance. Available: GHS ${currentBalance.toFixed(2)}` });
        }

        const [stores] = await connection.execute('SELECT id FROM agent_stores WHERE user_id = ?::uuid', [userId]);
        const storeId = stores[0]?.id || null;

        const withdrawalId = uuidv4();
        const newBalance = currentBalance - amount;

        // Atomic deduction check (WHERE available_balance >= amount)
        const [updateResult] = await connection.execute(
            `UPDATE agent_wallets 
             SET available_balance = available_balance - ?,
                 total_withdrawn = total_withdrawn + ?,
                 updated_at = NOW()
             WHERE agent_id = ?::uuid AND available_balance >= ?`,
            [amount, amount, userId, amount]
        );

        if (updateResult.affectedRows === 0 && updateResult.rowCount === 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, error: 'Transaction failed due to concurrent withdrawal attempt.' });
        }

        // Create withdrawal request
        await connection.execute(
            `INSERT INTO agent_withdrawals (id, agent_id, store_id, amount_ghc, payment_method, account_number, account_name, bank_momo_provider, status, created_at, updated_at)
             VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?, ?, ?, ?, 'REQUESTED', NOW(), NOW())`,
            [withdrawalId, userId, storeId, amount, payment_method || 'momo', account_number, account_name, bank_momo_provider]
        );

        // Record in ledger
        await connection.execute(
            `INSERT INTO agent_wallet_ledger (id, agent_id, store_id, type, amount_ghc, balance_after, description, reference, created_at)
             VALUES (?::uuid, ?::uuid, ?::uuid, 'WITHDRAWAL', ?, ?, ?, ?, NOW())`,
            [uuidv4(), userId, storeId, -amount, newBalance, `Withdrawal request to ${bank_momo_provider.toUpperCase()} (${account_number})`, withdrawalId]
        );

        await connection.commit();

        // Log activity (non-blocking)
        logActivity(userId, 'AGENT_WITHDRAWAL_REQUESTED', `Requested withdrawal of GHS ${amount.toFixed(2)} to ${bank_momo_provider.toUpperCase()} (${account_number})`, { withdrawalId, amount, payment_method, bank_momo_provider }, req.ip);

        res.json({
            success: true,
            message: 'Withdrawal request submitted successfully!',
            withdrawal_id: withdrawalId,
            new_balance: newBalance
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error requesting withdrawal:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to submit withdrawal request' });
    } finally {
        if (connection) connection.release();
    }
};

// 14. GET WITHDRAWAL HISTORY
exports.getWithdrawalHistory = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;

        const [withdrawals] = await connection.execute(
            `SELECT id, amount_ghc, payment_method, account_number, account_name, bank_momo_provider, status, admin_notes, created_at
             FROM agent_withdrawals
             WHERE agent_id = ?::uuid
             ORDER BY created_at DESC`,
            [userId]
        );

        res.json({ success: true, withdrawals });
    } catch (error) {
        console.error('Error getting withdrawal history:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve withdrawal history' });
    } finally {
        if (connection) connection.release();
    }
};

// 15. PUBLIC STOREFRONT (BY SLUG)
exports.getPublicStorefront = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { slug } = req.params;

        const [stores] = await connection.execute(
            `SELECT id, store_name, slug, description, phone, logo_url, review_status, activation_status, is_visible, created_at
             FROM agent_stores
             WHERE slug = ?`,
            [slug]
        );

        if (stores.length === 0) {
            return res.status(404).json({ success: false, error: 'Store not found' });
        }

        const store = stores[0];
        const effectiveStatus = deriveEffectiveStatus(store.review_status, store.activation_status, store.is_visible);

        if (effectiveStatus !== 'ACTIVE') {
            return res.status(403).json({
                success: false,
                error: `This Agent Store is currently ${effectiveStatus.toLowerCase()} and unavailable for purchases.`,
                effective_status: effectiveStatus
            });
        }

        if (effectiveStatus !== 'ACTIVE' || !store.is_visible) {
            return res.status(403).json({
                success: false,
                error: 'This Agent Store is currently inactive or undergoing maintenance.',
                store_name: store.store_name,
                effective_status: effectiveStatus
            });
        }

        // Fetch enabled products for this store
        const [products] = await connection.execute(
            `SELECT ap.id, b.id as bundle_id, b.network, b.data_amount, ap.agent_price_ghc
             FROM agent_store_products ap
             INNER JOIN data_bundles b ON ap.bundle_id = b.id
             WHERE ap.store_id = ?::uuid AND ap.is_enabled = TRUE AND b.is_active = TRUE
             ORDER BY b.network ASC, ap.agent_price_ghc ASC`,
            [store.id]
        );

        res.json({
            success: true,
            store: {
                id: store.id,
                store_name: store.store_name,
                slug: store.slug,
                description: store.description,
                phone: store.phone,
                logo_url: store.logo_url
            },
            products
        });
    } catch (error) {
        console.error('Error getting public storefront:', error);
        res.status(500).json({ success: false, error: 'Failed to load public storefront' });
    } finally {
        if (connection) connection.release();
    }
};

// 16. PUBLIC CUSTOMER PURCHASE INITIALIZE
exports.initializeCustomerPurchase = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { slug } = req.params;
        const { bundleId, customerPhone, callbackUrl } = req.body;

        if (!bundleId || !customerPhone) {
            return res.status(400).json({ success: false, error: 'Missing required fields: bundleId and customerPhone' });
        }

        // Fetch store
        const [stores] = await connection.execute(
            'SELECT id, user_id, store_name, review_status, activation_status, is_visible FROM agent_stores WHERE slug = ?',
            [slug]
        );

        if (stores.length === 0) {
            return res.status(404).json({ success: false, error: 'Agent Store not found' });
        }

        const store = stores[0];
        const effectiveStatus = deriveEffectiveStatus(store.review_status, store.activation_status, store.is_visible);

        if (effectiveStatus !== 'ACTIVE') {
            return res.status(400).json({ success: false, error: `Store is ${effectiveStatus.toLowerCase()} and not active for sales` });
        }

        // Fetch product & base price (must be enabled for store AND active in system)
        const [products] = await connection.execute(
            `SELECT ap.agent_price_ghc, b.id as bundle_id, b.network, b.data_amount, b.price_ghc as base_price_ghc
             FROM agent_store_products ap
             INNER JOIN data_bundles b ON ap.bundle_id = b.id
             WHERE ap.store_id = ?::uuid AND ap.bundle_id = ?::uuid AND ap.is_enabled = TRUE AND b.is_active = TRUE`,
            [store.id, bundleId]
        );

        if (products.length === 0) {
            return res.status(404).json({ success: false, error: 'Selected data bundle is not available in this store.' });
        }

        const prod = products[0];
        const basePrice = parseFloat(prod.base_price_ghc);
        const sellingPrice = parseFloat(prod.agent_price_ghc);
        const profit = Math.max(0, sellingPrice - basePrice);

        // PRECHECK: Centralized MTN beneficiary validation BEFORE Paystack initialization or order creation
        const { validateBeneficiaryBeforeOrder } = require('../services/mtnValidation.service');
        const validation = await validateBeneficiaryBeforeOrder({
            network: prod.network,
            recipientPhone: customerPhone,
            bundleSize: prod.data_amount,
            source: 'AGENT_STORE',
            agentId: store.user_id || null,
            agentStoreId: store.id || null
        });

        if (!validation.allowed) {
            connection.release();
            if (validation.status === 'pending_mtn_approval') {
                return res.status(422).json({
                    success: false,
                    error: {
                        code: 'BENEFICIARY_NOT_VALIDATED',
                        message: 'This MTN number has not yet been approved by MTN. It has been submitted for MTN approval. You will be able to place the order once the number is approved.'
                    },
                    code: 'BENEFICIARY_NOT_VALIDATED',
                    status: 'pending_mtn_approval',
                    message: 'This MTN number has not yet been approved by MTN. It has been submitted for MTN approval. You will be able to place the order once the number is approved.',
                    data: {
                        phoneNumber: customerPhone,
                        network: prod.network,
                        status: 'pending',
                        pendingApproval: true
                    }
                });
            }
            return res.status(400).json({
                success: false,
                error: validation.error || 'Recipient phone number is invalid or unverified.'
            });
        }

        const reference = `AG-ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const storefrontBase = (process.env.STOREFRONT_URL || 'https://apisolutions.store').replace(/\/$/, '');
        const resolvedCallback = callbackUrl || `${storefrontBase}/store/${slug}?reference=${reference}`;

        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!paystackSecretKey) {
            return res.status(500).json({ success: false, error: 'Payment service secret key not configured' });
        }

        // Initialize Paystack payment
        const paystackResponse = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: `customer-${customerPhone}@bytebeacon.online`,
                amount: Math.round(sellingPrice * 100),
                currency: 'GHS',
                reference,
                callback_url: resolvedCallback,
                metadata: {
                    type: 'AGENT_STORE_CUSTOMER_PURCHASE',
                    store_id: store.id,
                    agent_id: store.user_id,
                    bundle_id: bundleId,
                    customer_phone: customerPhone,
                    network: prod.network,
                    data_amount: prod.data_amount,
                    base_price_ghc: basePrice,
                    selling_price_ghc: sellingPrice,
                    profit_ghc: profit
                },
            }),
        });

        const paystackData = await paystackResponse.json();

        if (!paystackData.status || !paystackData.data) {
            return res.status(400).json({ success: false, error: paystackData.message || 'Payment initialization failed' });
        }

        // NOTE: Order is NOT inserted into agent_orders here.
        // It will only be inserted after Paystack confirms successful payment (in verify or webhook).

        res.json({
            success: true,
            authorization_url: paystackData.data.authorization_url,
            reference
        });
    } catch (error) {
        console.error('Error initializing customer purchase:', error);
        res.status(500).json({ success: false, error: error.message || 'Customer purchase initialization failed' });
    } finally {
        if (connection) connection.release();
    }
};

// 17. PUBLIC CUSTOMER PURCHASE VERIFY
exports.verifyCustomerPurchase = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { reference } = req.body;

        if (!reference) {
            return res.status(400).json({ success: false, error: 'Missing payment reference' });
        }

        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!paystackSecretKey) {
            return res.status(500).json({ success: false, error: 'Payment service not configured' });
        }

        // Verify with Paystack
        const verifyResponse = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
            headers: { 'Authorization': `Bearer ${paystackSecretKey}` },
        });

        const verifyData = await verifyResponse.json();

        if (!verifyData.status || !verifyData.data || verifyData.data.status !== 'success') {
            return res.status(400).json({ success: false, error: 'Payment verification failed' });
        }

        let [orders] = await connection.execute(
            `SELECT o.*, b.provider_slug 
             FROM agent_orders o
             LEFT JOIN data_bundles b ON o.bundle_id = b.id::uuid
             WHERE o.paystack_reference = ?`,
            [reference]
        );

        let order;

        // If order was not yet created (since initialization no longer pre-inserts orders), create it now!
        if (orders.length === 0) {
            const meta = verifyData.data.metadata || {};
            if (!meta.store_id || !meta.agent_id || !meta.bundle_id || !meta.customer_phone) {
                return res.status(400).json({ success: false, error: 'Invalid order metadata in payment verification' });
            }

            // SAFETY GATE: Re-verify MTN beneficiary before creating order from Paystack verify callback
            if ((meta.network || '').toUpperCase() === 'MTN') {
                const { validateBeneficiaryBeforeOrder } = require('../services/mtnValidation.service');
                const verifyValidation = await validateBeneficiaryBeforeOrder({
                    network: meta.network,
                    recipientPhone: meta.customer_phone,
                    bundleSize: meta.data_amount || 'Unknown',
                    source: 'AGENT_STORE',
                    agentId: meta.agent_id || null,
                    agentStoreId: meta.store_id || null
                });
                if (!verifyValidation.allowed) {
                    console.log(`🛡️ [VERIFY SAFETY GATE] MTN number ${meta.customer_phone} is unverified at verify time. Blocking order creation.`);
                    connection.release();
                    return res.status(422).json({
                        success: false,
                        code: 'BENEFICIARY_NOT_VALIDATED',
                        status: 'pending_mtn_approval',
                        message: verifyValidation.message || 'This MTN number has not yet been approved for data delivery.',
                        data: {
                            phoneNumber: meta.customer_phone,
                            network: 'MTN',
                            status: 'pending_approval',
                            pendingApproval: true
                        }
                    });
                }
            }

            const orderId = uuidv4();
            const sellingPrice = parseFloat(meta.selling_price_ghc || (verifyData.data.amount / 100));
            const basePrice = parseFloat(meta.base_price_ghc || 0);
            const profit = parseFloat(meta.profit_ghc || Math.max(0, sellingPrice - basePrice));

            // Fetch bundle provider slug
            const [bundleRows] = await connection.execute('SELECT provider_slug FROM data_bundles WHERE id = ?::uuid', [meta.bundle_id]);
            const providerSlug = bundleRows.length > 0 ? bundleRows[0].provider_slug : null;

            await connection.execute(
                `INSERT INTO agent_orders (id, store_id, agent_id, bundle_id, customer_phone, network, data_amount, base_price_ghc, selling_price_ghc, profit_ghc, paystack_reference, payment_status, fulfillment_status, created_at, updated_at)
                 VALUES (?::uuid, ?::uuid, ?::uuid, ?::uuid, ?, ?, ?, ?, ?, ?, ?, 'paid', 'processing', NOW(), NOW())`,
                [orderId, meta.store_id, meta.agent_id, meta.bundle_id, meta.customer_phone, meta.network, meta.data_amount, basePrice, sellingPrice, profit, reference]
            );

            order = {
                id: orderId,
                store_id: meta.store_id,
                agent_id: meta.agent_id,
                bundle_id: meta.bundle_id,
                customer_phone: meta.customer_phone,
                network: meta.network,
                data_amount: meta.data_amount,
                base_price_ghc: basePrice,
                selling_price_ghc: sellingPrice,
                profit_ghc: profit,
                paystack_reference: reference,
                payment_status: 'paid',
                fulfillment_status: 'processing',
                provider_slug: providerSlug
            };
        } else {
            order = orders[0];
        }

        if (order.fulfillment_status === 'completed') {
            return res.json({
                success: true,
                status: 'completed',
                message: `Data bundle delivered: ${order.network} ${order.data_amount} to ${order.customer_phone}`,
                order_id: order.id
            });
        }

        // SECURITY: Verify currency and amount matches expected order price in pesewas
        const expectedPesewas = Math.round(parseFloat(order.selling_price_ghc) * 100);
        if (verifyData.data.currency !== 'GHS' || Math.abs(verifyData.data.amount - expectedPesewas) > 1) {
            console.error(`🚨 Security Alert: Customer purchase amount/currency mismatch for order ${order.id}. Expected: ${expectedPesewas} GHS pesewas, Received: ${verifyData.data.amount} ${verifyData.data.currency}`);
            return res.status(400).json({ success: false, error: 'Customer payment verification failed: Amount or currency mismatch' });
        }

        // Mark payment paid & processing
        await connection.execute(
            `UPDATE agent_orders 
             SET payment_status = 'paid', fulfillment_status = 'processing', updated_at = NOW() 
             WHERE id = ?::uuid`,
            [order.id]
        );

        // MTN Pre-check: Check if MTN recipient number is already validated before attempting data order
        let isMtnUnverified = false;
        if ((order.network || '').toUpperCase() === 'MTN') {
            try {
                const { precheckBeneficiary } = require('../utils/datahouse');
                const precheckRes = await precheckBeneficiary('MTN', [order.customer_phone], true);
                if (precheckRes.success && precheckRes.data && Array.isArray(precheckRes.data)) {
                    const match = precheckRes.data.find(b => b.phoneNumber === order.customer_phone || b.phone === order.customer_phone);
                    if (match && match.known === false) {
                        isMtnUnverified = true;
                    }
                }
            } catch (precheckErr) {
                console.warn('⚠️ MTN Precheck soft error:', precheckErr.message);
            }
        }

        let fulfillment = null;
        let finalFulfillmentStatus = 'processing';

        if (isMtnUnverified) {
            console.log(`📱 MTN recipient ${order.customer_phone} requires MTN approval. Order ${order.id} set to pending_mtn_approval.`);
            finalFulfillmentStatus = 'pending_mtn_approval';
            fulfillment = {
                status: 'pending_mtn_approval',
                providerPublicId: null,
                providerReferenceCode: null,
                orderId: order.id,
                apiResponse: { message: 'Awaiting MTN Approval — Number recorded for validation.' }
            };
        } else {
            // Place Data Bundle order with Provider via Sourcing router
            fulfillment = await placeDataOrder({
                network: order.network,
                dataAmount: order.data_amount,
                recipientPhone: order.customer_phone,
                transactionId: order.id,
                providerSlug: order.provider_slug
            });
            finalFulfillmentStatus = fulfillment.status;
        }
        const fulfillmentApiResponse = {
            paystack: verifyData,
            provider_fulfillment: fulfillment.apiResponse,
            providerPublicId: fulfillment.providerPublicId || fulfillment.orderId,
            providerReferenceCode: fulfillment.providerReferenceCode || fulfillment.orderReference,
            orderId: fulfillment.orderId
        };

        const dhOrderId = fulfillment.providerPublicId || fulfillment.orderId || null;
        const dhRefCode = fulfillment.providerReferenceCode || fulfillment.orderReference || null;
        const dhStatus = fulfillment.status || finalFulfillmentStatus;

        if (finalFulfillmentStatus === 'completed') {
            await connection.beginTransaction();

            // Update order status, api_response and DataHouse tracking metadata
            await connection.execute(
                `UPDATE agent_orders 
                 SET fulfillment_status = 'completed', 
                     api_response = ?,
                     datahouse_order_id = COALESCE(?, datahouse_order_id),
                     reference_code = COALESCE(?, reference_code),
                     current_datahouse_status = ?,
                     mapped_bytebeacon_status = 'completed',
                     last_synced_at = CURRENT_TIMESTAMP,
                     sync_status = 'synced',
                     updated_at = NOW() 
                 WHERE id = ?::uuid`,
                [JSON.stringify(fulfillmentApiResponse), dhOrderId, dhRefCode, dhStatus, order.id]
            );

            // Credit agent profit to agent_wallets
            const profitGhc = parseFloat(order.profit_ghc);

            const [wallets] = await connection.execute('SELECT available_balance FROM agent_wallets WHERE agent_id = ?::uuid', [order.agent_id]);
            const currentAvail = wallets.length > 0 ? parseFloat(wallets[0].available_balance) : 0.00;
            const newAvail = currentAvail + profitGhc;

            // Atomically update wallet balance
            await connection.execute(
                `UPDATE agent_wallets 
                 SET available_balance = available_balance + ?,
                     total_profit_earned = total_profit_earned + ?,
                     updated_at = NOW()
                 WHERE agent_id = ?::uuid`,
                [profitGhc, profitGhc, order.agent_id]
            );

            // Record ledger entry
            await connection.execute(
                `INSERT INTO agent_wallet_ledger (id, agent_id, store_id, order_id, type, amount_ghc, balance_after, description, reference, created_at)
                 VALUES (?::uuid, ?::uuid, ?::uuid, ?::uuid, 'SALE_PROFIT', ?, ?, ?, ?, NOW())`,
                [uuidv4(), order.agent_id, order.store_id, order.id, profitGhc, newAvail, `Markup profit for ${order.network} ${order.data_amount} sale`, reference]
            );

            await connection.commit();
        } else if (finalFulfillmentStatus === 'processing' || finalFulfillmentStatus === 'received') {
            // Update order status as processing and save DataHouse tracking metadata
            await connection.execute(
                `UPDATE agent_orders 
                 SET fulfillment_status = 'processing', 
                     api_response = ?,
                     datahouse_order_id = COALESCE(?, datahouse_order_id),
                     reference_code = COALESCE(?, reference_code),
                     current_datahouse_status = ?,
                     mapped_bytebeacon_status = 'processing',
                     last_synced_at = CURRENT_TIMESTAMP,
                     sync_status = 'synced',
                     updated_at = NOW() 
                 WHERE id = ?::uuid`,
                [JSON.stringify(fulfillmentApiResponse), dhOrderId, dhRefCode, dhStatus, order.id]
            );
        } else if (finalFulfillmentStatus === 'pending_mtn_approval') {
            console.log(`📱 Order ${order.id} requires Pending MTN Approval. Purging from agent_orders and recording in MTN approvals system.`);
            
            // Record in mtn_beneficiary_approvals database system
            const { recordPendingBeneficiary } = require('../services/mtnApproval.service');
            await recordPendingBeneficiary({
                phone: order.customer_phone,
                network: order.network,
                bundleSize: order.data_amount,
                source: 'Agent Storefront',
                orderId: order.id,
                orderReference: order.paystack_reference || reference
            }).catch(err => console.warn('⚠️ Record pending beneficiary warning:', err.message));

            // Purge from agent_orders so NO record exists in normal order tables
            await connection.execute(`DELETE FROM agent_orders WHERE id = ?::uuid`, [order.id]);

            return res.json({
                success: true,
                status: 'pending_mtn_approval',
                message: 'Awaiting MTN Approval — This recipient\'s MTN number requires approval before data can be delivered.'
            });
        } else if (finalFulfillmentStatus === 'rejected') {
            // Rejection rule: If number is rejected by DataHouse, PURGE/DELETE the order from agent_orders completely
            console.log(`🚫 Order ${order.id} rejected by provider. Deleting order record from database so it does not reflect in system.`);
            await connection.execute(`DELETE FROM agent_orders WHERE id = ?::uuid`, [order.id]);

            return res.status(400).json({
                success: false,
                status: 'rejected',
                error: 'Recipient phone number was rejected by network provider. Payment will be refunded and no order was recorded.'
            });
        } else {
            // Update order status as failed
            await connection.execute(
                `UPDATE agent_orders 
                 SET fulfillment_status = 'failed', api_response = ?, updated_at = NOW() 
                 WHERE id = ?::uuid`,
                [JSON.stringify(fulfillmentApiResponse), order.id]
            );
        }

        res.json({
            success: true,
            status: finalFulfillmentStatus,
            message: finalFulfillmentStatus === 'completed'
                ? `Data bundle delivered: ${order.network} ${order.data_amount} to ${order.customer_phone}`
                : finalFulfillmentStatus === 'pending_mtn_approval'
                ? `Awaiting MTN Approval — This recipient's MTN number requires approval before data can be delivered.`
                : finalFulfillmentStatus === 'processing'
                ? `Order placed and queued for delivery with provider.`
                : 'Data purchase failed. Please check order details.',
            order_id: order.id
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error verifying customer purchase:', error);
        res.status(500).json({ success: false, error: 'Customer purchase verification failed' });
    } finally {
        if (connection) connection.release();
    }
};

// 18. TRACK PUBLIC ORDER
exports.trackPublicOrder = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { orderId } = req.params;

        const [orders] = await connection.execute(
            `SELECT id, customer_phone, network, data_amount, selling_price_ghc, payment_status, fulfillment_status, created_at
             FROM agent_orders
             WHERE id::text = ? OR paystack_reference = ?`,
            [orderId, orderId]
        );

        if (orders.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        res.json({ success: true, order: orders[0] });
    } catch (error) {
        console.error('Error tracking order:', error);
        res.status(500).json({ success: false, error: 'Failed to track order' });
    } finally {
        if (connection) connection.release();
    }
};

// 19. GET AGENT MTN BENEFICIARY APPROVAL STATUSES FROM DATAHOUSE
exports.getAgentBeneficiaries = async (req, res) => {
    try {
        const { status, network, search, page, limit } = req.query;
        const { getBeneficiaryApprovalStatus } = require('../utils/datahouse');
        const result = await getBeneficiaryApprovalStatus({ status, network, search, page, limit });

        if (!result.success) {
            return res.status(400).json({ success: false, error: result.error || 'Failed to fetch MTN beneficiaries' });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        console.error('Error fetching agent beneficiaries:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch beneficiaries' });
    }
};

// 20. EXPORT AGENT STORE ORDERS
exports.exportAgentOrders = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;
        const { status, network, search, format = 'csv' } = req.query;

        const safeFormat = ['csv', 'excel', 'xlsx', 'json'].includes(String(format).toLowerCase())
            ? String(format).toLowerCase()
            : 'csv';

        const [stores] = await connection.execute('SELECT id, store_name FROM agent_stores WHERE user_id = ?::uuid', [userId]);
        if (stores.length === 0) return res.status(404).json({ success: false, error: 'Store not found' });
        const storeId = stores[0].id;
        const storeName = stores[0].store_name;

        let query = `
            SELECT id, customer_phone, network, data_amount, base_price_ghc, selling_price_ghc, profit_ghc,
                   paystack_reference, payment_status, fulfillment_status, created_at
            FROM agent_orders
            WHERE store_id = ?::uuid AND fulfillment_status != 'pending_mtn_approval'
        `;
        const params = [storeId];

        if (status && status !== 'all') {
            query += ` AND fulfillment_status = ?`;
            params.push(status);
        }
        if (network && network !== 'all') {
            query += ` AND network = ?`;
            params.push(network);
        }
        if (search) {
            query += ` AND (customer_phone LIKE ? OR id::text LIKE ? OR paystack_reference LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        query += ` ORDER BY created_at DESC LIMIT 50000`;

        const [orders] = await connection.execute(query, params);

        const columns = [
            { key: 'id', label: 'Order ID' },
            { key: 'customer_phone', label: 'Customer Phone' },
            { key: 'network', label: 'Network' },
            { key: 'data_amount', label: 'Data Plan' },
            {
                key: 'base_price_ghc',
                label: 'Base Cost (GH₵)',
                transform: (r) => r.base_price_ghc !== null && r.base_price_ghc !== undefined ? parseFloat(r.base_price_ghc) : 0
            },
            {
                key: 'selling_price_ghc',
                label: 'Selling Price (GH₵)',
                transform: (r) => r.selling_price_ghc !== null && r.selling_price_ghc !== undefined ? parseFloat(r.selling_price_ghc) : 0
            },
            {
                key: 'profit_ghc',
                label: 'Profit Earned (GH₵)',
                transform: (r) => r.profit_ghc !== null && r.profit_ghc !== undefined ? parseFloat(r.profit_ghc) : 0
            },
            { key: 'payment_status', label: 'Payment Status' },
            { key: 'fulfillment_status', label: 'Fulfillment Status' },
            { key: 'paystack_reference', label: 'Payment Ref' },
            {
                key: 'created_at',
                label: 'Date Created',
                transform: (r) => r.created_at ? new Date(r.created_at).toISOString() : ''
            }
        ];

        return sendExportResponse(res, {
            data: orders,
            columns,
            filename: `agent_store_${storeName}_orders`,
            format: safeFormat,
            sheetName: 'Store Orders'
        });

    } catch (error) {
        console.error('Error exporting agent orders:', error);
        return res.status(500).json({ success: false, error: 'Failed to export store orders' });
    } finally {
        if (connection) connection.release();
    }
};

// 21. EXPORT AGENT WALLET LEDGER
exports.exportAgentLedger = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;
        const { format = 'csv' } = req.query;

        const safeFormat = ['csv', 'excel', 'xlsx', 'json'].includes(String(format).toLowerCase())
            ? String(format).toLowerCase()
            : 'csv';

        const [ledger] = await connection.execute(
            `SELECT id, type, amount_ghc, balance_after, description, reference, created_at
             FROM agent_wallet_ledger
             WHERE agent_id = ?::uuid
             ORDER BY created_at DESC
             LIMIT 50000`,
            [userId]
        );

        const columns = [
            { key: 'id', label: 'Transaction ID' },
            { key: 'type', label: 'Transaction Type' },
            {
                key: 'amount_ghc',
                label: 'Amount (GH₵)',
                transform: (r) => r.amount_ghc !== null && r.amount_ghc !== undefined ? parseFloat(r.amount_ghc) : 0
            },
            {
                key: 'balance_after',
                label: 'Balance After (GH₵)',
                transform: (r) => r.balance_after !== null && r.balance_after !== undefined ? parseFloat(r.balance_after) : 0
            },
            { key: 'description', label: 'Description' },
            { key: 'reference', label: 'Reference' },
            {
                key: 'created_at',
                label: 'Date',
                transform: (r) => r.created_at ? new Date(r.created_at).toISOString() : ''
            }
        ];

        return sendExportResponse(res, {
            data: ledger,
            columns,
            filename: 'agent_wallet_ledger',
            format: safeFormat,
            sheetName: 'Wallet Ledger'
        });

    } catch (error) {
        console.error('Error exporting agent ledger:', error);
        return res.status(500).json({ success: false, error: 'Failed to export wallet ledger' });
    } finally {
        if (connection) connection.release();
    }
};

// 22. EXPORT AGENT WITHDRAWALS
exports.exportAgentWithdrawals = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;
        const { format = 'csv' } = req.query;

        const safeFormat = ['csv', 'excel', 'xlsx', 'json'].includes(String(format).toLowerCase())
            ? String(format).toLowerCase()
            : 'csv';

        const [withdrawals] = await connection.execute(
            `SELECT id, amount_ghc, fee_ghc, net_amount_ghc, momo_number, momo_network, account_holder_name,
                    status, rejection_reason, created_at, processed_at
             FROM agent_withdrawals
             WHERE agent_id = ?::uuid
             ORDER BY created_at DESC
             LIMIT 50000`,
            [userId]
        );

        const columns = [
            { key: 'id', label: 'Withdrawal ID' },
            {
                key: 'amount_ghc',
                label: 'Requested Amount (GH₵)',
                transform: (r) => r.amount_ghc !== null && r.amount_ghc !== undefined ? parseFloat(r.amount_ghc) : 0
            },
            {
                key: 'fee_ghc',
                label: 'Fee (GH₵)',
                transform: (r) => r.fee_ghc !== null && r.fee_ghc !== undefined ? parseFloat(r.fee_ghc) : 0
            },
            {
                key: 'net_amount_ghc',
                label: 'Net Payout (GH₵)',
                transform: (r) => r.net_amount_ghc !== null && r.net_amount_ghc !== undefined ? parseFloat(r.net_amount_ghc) : 0
            },
            { key: 'momo_network', label: 'MoMo Network' },
            { key: 'momo_number', label: 'MoMo Number' },
            { key: 'account_holder_name', label: 'Account Name' },
            { key: 'status', label: 'Payout Status' },
            { key: 'rejection_reason', label: 'Rejection Reason' },
            {
                key: 'created_at',
                label: 'Requested Date',
                transform: (r) => r.created_at ? new Date(r.created_at).toISOString() : ''
            },
            {
                key: 'processed_at',
                label: 'Processed Date',
                transform: (r) => r.processed_at ? new Date(r.processed_at).toISOString() : ''
            }
        ];

        return sendExportResponse(res, {
            data: withdrawals,
            columns,
            filename: 'agent_payouts_history',
            format: safeFormat,
            sheetName: 'Payout History'
        });

    } catch (error) {
        console.error('Error exporting agent withdrawals:', error);
        return res.status(500).json({ success: false, error: 'Failed to export withdrawals history' });
    } finally {
        if (connection) connection.release();
    }
};
