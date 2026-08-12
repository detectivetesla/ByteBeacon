const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { placeDataOrder, getSourcingConfig } = require('../utils/sourcing');
const { triggerTransactionWebhook } = require('../services/partnerWebhook.service');

// 1. Get Available Plans (GET /api/v1/plans)
const getPlans = async (req, res) => {
    try {
        const [bundles] = await pool.execute(
            'SELECT id, network, data_amount, price_ghc FROM data_bundles WHERE is_active = true ORDER BY network, price_ghc'
        );

        const formattedPlans = bundles.map(b => ({
            id: b.id,
            network: b.network,
            name: b.data_amount,
            price: parseFloat(b.price_ghc)
        }));

        res.json({
            success: true,
            plans: formattedPlans
        });
    } catch (err) {
        console.error('API getPlans error:', err.message);
        res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Failed to fetch plans.' });
    }
};

// 2. Buy Data Bundle (POST /api/v1/data/purchase)
const purchaseData = async (req, res) => {
    let connection;
    try {
        const partner = req.partner;

        // Extract inputs supporting various SMM and VTU panel parameter naming conventions
        const phoneField = req.body.phone || req.body.recipient_phone || req.body.phone_number || req.body.number || req.body.link || req.body.recipient;
        const planIdField = req.body.plan_id || req.body.bundle_id || req.body.plan || req.body.service || req.body.offer_id;
        const networkField = req.body.network;
        const referenceField = req.body.reference || req.body.client_reference || req.body.ref;

        // Validation
        if (!networkField || !phoneField || !planIdField) {
            return res.status(400).json({ 
                success: false, 
                error: 'Bad Request', 
                message: 'network, phone, and plan_id are required fields (or SMM link/service mappings).' 
            });
        }

        // UUID validation
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planIdField);
        if (!isUuid) {
            return res.status(400).json({ success: false, error: 'Bad Request', message: 'plan_id (or service parameter) must be a valid UUID.' });
        }

        // Get bundle details
        const [bundles] = await pool.execute(
            'SELECT id, network, data_amount, price_ghc, agent_price_ghc, provider_slug FROM data_bundles WHERE id = ?::uuid AND is_active = true',
            [planIdField]
        );

        if (bundles.length === 0) {
            return res.status(404).json({ success: false, error: 'Not Found', message: 'Requested plan was not found or is inactive.' });
        }

        const bundle = bundles[0];

        // Verify network match
        if (bundle.network.toUpperCase() !== networkField.toUpperCase()) {
            return res.status(400).json({ 
                success: false, 
                error: 'Bad Request', 
                message: `Network mismatch. Plan ${planIdField} is for ${bundle.network}, not ${networkField}.` 
            });
        }

        // Start Transaction with row-level locking to prevent concurrent double-spending
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const isAgent = partner.is_agent || false;
        let activePartner = null;

        if (isAgent) {
            // Lock user's profile row for update
            const [lockedProfiles] = await connection.execute(
                'SELECT id, full_name, wallet_balance FROM profiles WHERE id = ?::uuid FOR UPDATE',
                [partner.id]
            );
            if (lockedProfiles.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ success: false, error: 'Not Found', message: 'User profile not found.' });
            }
            const profile = lockedProfiles[0];
            activePartner = {
                id: profile.id,
                user_id: profile.id,
                business_name: `${profile.full_name}'s API`,
                wallet_balance: parseFloat(profile.wallet_balance) || 0.00,
                credit_enabled: false,
                credit_limit: 0.00,
                outstanding_balance: 0.00,
                allow_unlimited_purchases: false,
                is_agent: true
            };
        } else {
            // Lock partner row for update
            const [lockedPartners] = await connection.execute(
                'SELECT * FROM partners WHERE id = ?::uuid FOR UPDATE',
                [partner.id]
            );
            if (lockedPartners.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ success: false, error: 'Not Found', message: 'Partner profile not found.' });
            }
            activePartner = lockedPartners[0];
            activePartner.wallet_balance = parseFloat(activePartner.wallet_balance) || 0.00;
        }

        // PRECHECK: Centralized MTN beneficiary validation BEFORE charging or creating transaction
        const { validateBeneficiaryBeforeOrder } = require('../services/mtnValidation.service');
        const validation = await validateBeneficiaryBeforeOrder({
            network: bundle.network,
            recipientPhone: phoneField,
            bundleSize: bundle.data_amount,
            source: 'API'
        });

        if (!validation.allowed) {
            await connection.rollback();
            connection.release();

            if (validation.status === 'pending_mtn_approval') {
                return res.status(422).json({
                    success: false,
                    error: {
                        code: 'BENEFICIARY_NOT_VALIDATED',
                        message: 'This MTN number has not yet been approved by MTN. It has been submitted for MTN approval. You will be able to place the order once the number is approved.'
                    },
                    code: 'BENEFICIARY_NOT_VALIDATED',
                    message: 'This MTN number has not yet been approved by MTN. It has been submitted for MTN approval. You will be able to place the order once the number is approved.',
                    data: {
                        phoneNumber: phoneField,
                        network: bundle.network,
                        status: 'pending',
                        pendingApproval: true
                    }
                });
            }

            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: validation.error || 'Beneficiary validation failed.'
            });
        }

        // Determine final pricing
        let finalPrice = parseFloat(bundle.price_ghc);
        if (activePartner.user_id) {
            const [customPricing] = await connection.execute(
                'SELECT custom_price FROM agent_pricing WHERE agent_id = ?::uuid AND bundle_id = ?::uuid',
                [activePartner.user_id, bundle.id]
            );
            if (customPricing.length > 0) {
                finalPrice = parseFloat(customPricing[0].custom_price);
            } else {
                finalPrice = parseFloat(bundle.agent_price_ghc || bundle.price_ghc);
            }
        } else {
            finalPrice = parseFloat(bundle.agent_price_ghc || bundle.price_ghc);
        }

        // Enforce Billing Modes
        if (req.isTest) {
            // Sandbox/Test mode: skip wallet changes, record a test ledger entry if not agent
            if (!isAgent) {
                await connection.execute(
                    `INSERT INTO partner_ledger (partner_id, type, amount, description, reference)
                     VALUES (?::uuid, 'debit', ?, ?, ?)`,
                    [activePartner.id, 0.00, `SANDBOX TEST: ${bundle.data_amount} ${bundle.network} for ${phoneField}`, referenceField || '']
                );
            }
        } else if (activePartner.allow_unlimited_purchases) {
            // Trusted Partner Mode - Accumulate debt unlimited
            await connection.execute(
                'UPDATE partners SET outstanding_balance = outstanding_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                [finalPrice, activePartner.id]
            );
            await connection.execute(
                `INSERT INTO partner_ledger (partner_id, type, amount, description, reference)
                 VALUES (?::uuid, 'debit', ?, ?, ?)`,
                [activePartner.id, finalPrice, `API purchase: ${bundle.data_amount} ${bundle.network} for ${phoneField}`, referenceField || '']
            );
        } else if (activePartner.credit_enabled) {
            // Credit Mode - Check credit limits
            const creditLimit = parseFloat(activePartner.credit_limit);
            const outstanding = parseFloat(activePartner.outstanding_balance);
            if (outstanding + finalPrice > creditLimit) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ 
                    success: false, 
                    error: 'Insufficient Funds', 
                    message: `Credit limit exceeded. Limit: ₵${creditLimit.toFixed(2)}, Outstanding: ₵${outstanding.toFixed(2)}.` 
                });
            }

            await connection.execute(
                'UPDATE partners SET outstanding_balance = outstanding_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                [finalPrice, activePartner.id]
            );
            await connection.execute(
                `INSERT INTO partner_ledger (partner_id, type, amount, description, reference)
                 VALUES (?::uuid, 'debit', ?, ?, ?)`,
                [activePartner.id, finalPrice, `API credit purchase: ${bundle.data_amount} ${bundle.network} for ${phoneField}`, referenceField || '']
            );
        } else {
            // Prepaid Mode - Check wallet balance
            const walletBalance = parseFloat(activePartner.wallet_balance);
            if (walletBalance < finalPrice) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ 
                    success: false, 
                    error: 'Insufficient Funds', 
                    message: `Insufficient prepaid wallet balance. Balance: ₵${walletBalance.toFixed(2)}, Required: ₵${finalPrice.toFixed(2)}.` 
                });
            }

            if (isAgent) {
                // Deduct from user profiles & users
                await connection.execute(
                    'UPDATE profiles SET wallet_balance = wallet_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                    [finalPrice, activePartner.id]
                );
                await connection.execute(
                    'UPDATE users SET wallet_balance = wallet_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE uuid = ?::uuid',
                    [finalPrice, activePartner.id]
                );
            } else {
                await connection.execute(
                    'UPDATE partners SET wallet_balance = wallet_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                    [finalPrice, activePartner.id]
                );
                await connection.execute(
                    `INSERT INTO partner_ledger (partner_id, type, amount, description, reference)
                     VALUES (?::uuid, 'debit', ?, ?, ?)`,
                    [activePartner.id, finalPrice, `API prepaid purchase: ${bundle.data_amount} ${bundle.network} for ${phoneField}`, referenceField || '']
                );
            }
        }

        // Create transaction record
        const transactionId = uuidv4();
        const sourcingConfig = await getSourcingConfig();
        const activeProviderSlug = sourcingConfig.active_sourcing_api || 'datahouse';
        const assignedProvider = bundle.provider_slug || activeProviderSlug;
        
        const balanceBefore = activePartner.wallet_balance;
        const balanceAfter = req.isTest || activePartner.credit_enabled || activePartner.allow_unlimited_purchases
            ? balanceBefore
            : (balanceBefore - finalPrice);

        await connection.execute(
            `INSERT INTO transactions 
             (id, user_id, partner_id, bundle_id, recipient_phone, amount_ghc, status, balance_before, balance_after, source, paid, source_provider)
             VALUES (?::uuid, ?::uuid, ?::uuid, ?::uuid, ?, ?, ?, ?, ?, 'api', 'yes', ?)`,
            [
                transactionId, 
                activePartner.user_id || null, 
                isAgent ? null : activePartner.id, 
                bundle.id, 
                phoneField, 
                req.isTest ? 0.00 : finalPrice, 
                req.isTest ? 'completed' : 'processing',
                balanceBefore,
                balanceAfter,
                assignedProvider
            ]
        );

        // Commit transaction and release connection
        await connection.commit();
        connection.release();

        // 3. Fulfill order with Portal-02 inline if operating hours are online
        const hour = new Date().getHours();
        const isOffline = hour < 7 || hour >= 22;

        let finalStatus = req.isTest ? 'completed' : 'processing';
        let apiResponse = req.isTest ? { status: 'SUCCESS', message: 'Sandbox test order completed successfully', test_mode: true } : null;

        if (req.isTest) {
            // Update database to finalize test status
            await pool.execute(
                'UPDATE transactions SET status = ?, api_response = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                [finalStatus, JSON.stringify(apiResponse), transactionId]
            );
        } else if (!isOffline) {
            try {
                console.log(`🚀 [PARTNER API] Fulfilling order ${transactionId}...`);
                const fulfillment = await placeDataOrder({
                    network: bundle.network,
                    dataAmount: bundle.data_amount,
                    recipientPhone: phoneField,
                    transactionId: transactionId,
                    providerSlug: bundle.provider_slug
                });

                apiResponse = fulfillment.apiResponse || { error: fulfillment.message || fulfillment.error };

                if (fulfillment.status === 'pending_mtn_approval') {
                    console.log(`📱 [PARTNER API] Provider returned pending_mtn_approval for ${transactionId}. Restoring balance and purging order record.`);
                    
                    // 1. Record in MTN Beneficiary Approval system
                    const { recordPendingBeneficiary } = require('../services/mtnApproval.service');
                    await recordPendingBeneficiary({
                        phone: phoneField,
                        network: bundle.network,
                        bundleSize: bundle.data_amount,
                        source: 'Partner API'
                    });

                    // 2. Restore balance/credit if debited
                    if (!req.isTest && !activePartner.allow_unlimited_purchases && !activePartner.credit_enabled) {
                        if (isAgent) {
                            await pool.execute('UPDATE profiles SET wallet_balance = wallet_balance + ? WHERE id = ?::uuid', [finalPrice, activePartner.id]);
                            await pool.execute('UPDATE users SET wallet_balance = wallet_balance + ? WHERE uuid = ?::uuid', [finalPrice, activePartner.id]);
                        } else {
                            await pool.execute('UPDATE partners SET wallet_balance = wallet_balance + ? WHERE id = ?::uuid', [finalPrice, activePartner.id]);
                        }
                    } else if (activePartner.credit_enabled || activePartner.allow_unlimited_purchases) {
                        await pool.execute('UPDATE partners SET outstanding_balance = GREATEST(0, outstanding_balance - ?) WHERE id = ?::uuid', [finalPrice, activePartner.id]);
                    }

                    // 3. Purge transaction so NO order record exists in transactions table
                    await pool.execute('DELETE FROM transactions WHERE id = ?::uuid', [transactionId]);

                    return res.status(422).json({
                        success: false,
                        code: 'BENEFICIARY_NOT_VALIDATED',
                        transaction_id: null,
                        status: 'pending_mtn_approval',
                        message: 'Awaiting MTN Approval — This recipient\'s MTN number requires approval before data can be delivered.'
                    });
                }

                if (fulfillment.success) {
                    finalStatus = fulfillment.status; // 'completed' or 'processing'
                } else if (fulfillment.apiResponse && fulfillment.status === 'failed') {
                    finalStatus = 'failed';
                }

                // Update database
                await pool.execute(
                    'UPDATE transactions SET status = ?, api_response = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                    [finalStatus, JSON.stringify(apiResponse), transactionId]
                );

                // Record in MTN Beneficiary Approval system if pending MTN approval
                if (finalStatus === 'pending_mtn_approval') {
                    const { recordPendingBeneficiary } = require('../services/mtnApproval.service');
                    await recordPendingBeneficiary({
                        phone: phoneField,
                        network: bundle.network,
                        bundleSize: bundle.data_amount,
                        source: 'API',
                        orderId: transactionId,
                        orderReference: transactionId
                    }).catch(err => console.warn('⚠️ Record pending beneficiary warning:', err.message));
                }

                // If explicitly failed, issue automated refund using processAutomatedRefund
                if (finalStatus === 'failed') {
                    console.log(`💰 [PARTNER API] Refunding failed transaction ${transactionId}...`);
                    const { processAutomatedRefund } = require('../utils/refundHelper');
                    await processAutomatedRefund({
                        transactionId,
                        userId: isAgent ? activePartner.id : null,
                        partnerId: isAgent ? null : activePartner.id,
                        amountGhc: finalPrice,
                        reason: `Failed API order: ${bundle.data_amount} ${bundle.network} to ${phoneField}`
                    });
                }
            } catch (portalError) {
                console.error(`❌ Portal-02 order error for partner transaction ${transactionId}:`, portalError.message);
                // Keep status 'processing' for cron retry job
            }
        }

        // Trigger Webhook dispatch asynchronously
        triggerTransactionWebhook(transactionId, finalStatus).catch(() => {});

        res.status(201).json({
            success: true,
            transaction_id: transactionId,
            status: finalStatus === 'pending' ? 'processing' : finalStatus
        });

    } catch (err) {
        if (connection) {
            await connection.rollback().catch(() => {});
            connection.release();
        }
        console.error('Critical Partner Purchase error:', err.message);
        res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Failed to process purchase.' });
    }
};

// 3. Get Transaction Status (GET /api/v1/transactions/:id)
const getTransactionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const partner = req.partner;
        const isAgent = partner.is_agent || false;

        const query = isAgent
            ? `SELECT t.id, t.status, t.recipient_phone, t.amount_ghc, t.created_at, d.network, d.data_amount
               FROM transactions t
               LEFT JOIN data_bundles d ON t.bundle_id = d.id::uuid
               WHERE t.id = ?::uuid AND t.user_id = ?::uuid`
            : `SELECT t.id, t.status, t.recipient_phone, t.amount_ghc, t.created_at, d.network, d.data_amount
               FROM transactions t
               LEFT JOIN data_bundles d ON t.bundle_id = d.id::uuid
               WHERE t.id = ?::uuid AND t.partner_id = ?::uuid`;

        const [transactions] = await pool.execute(query, [id, partner.id]);

        if (transactions.length === 0) {
            return res.status(404).json({ success: false, error: 'Not Found', message: 'Transaction not found.' });
        }

        const t = transactions[0];
        res.json({
            success: true,
            transaction_id: t.id,
            status: t.status,
            network: t.network,
            recipient_phone: t.recipient_phone,
            amount: parseFloat(t.amount_ghc),
            created_at: t.created_at
        });
    } catch (err) {
        console.error('API getTransactionStatus error:', err.message);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

// 4. Get Transaction History (GET /api/v1/transactions)
const getTransactions = async (req, res) => {
    try {
        const partner = req.partner;
        const { limit = 50, offset = 0 } = req.query;
        const isAgent = partner.is_agent || false;

        const query = isAgent
            ? `SELECT t.id, t.status, t.recipient_phone, t.amount_ghc, t.created_at, d.network, d.data_amount
               FROM transactions t
               LEFT JOIN data_bundles d ON t.bundle_id = d.id::uuid
               WHERE t.user_id = ?::uuid AND t.status != 'pending_mtn_approval'
               ORDER BY t.created_at DESC
               LIMIT ? OFFSET ?`
            : `SELECT t.id, t.status, t.recipient_phone, t.amount_ghc, t.created_at, d.network, d.data_amount
               FROM transactions t
               LEFT JOIN data_bundles d ON t.bundle_id = d.id::uuid
               WHERE t.partner_id = ?::uuid AND t.status != 'pending_mtn_approval'
               ORDER BY t.created_at DESC
               LIMIT ? OFFSET ?`;

        const [transactions] = await pool.execute(
            query,
            [partner.id, parseInt(limit), parseInt(offset)]
        );

        const formatted = transactions.map(t => ({
            transaction_id: t.id,
            status: t.status,
            network: t.network,
            recipient_phone: t.recipient_phone,
            amount: parseFloat(t.amount_ghc),
            created_at: t.created_at
        }));

        res.json({
            success: true,
            transactions: formatted
        });
    } catch (err) {
        console.error('API getTransactions error:', err.message);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

// 5. Get Wallet Balance (GET /api/v1/wallet)
const getWallet = async (req, res) => {
    try {
        res.json({
            success: true,
            balance: parseFloat(req.partner.wallet_balance)
        });
    } catch (err) {
        console.error('API getWallet error:', err.message);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

// 6. Get Credit Status (GET /api/v1/credit)
const getCredit = async (req, res) => {
    try {
        const partner = req.partner;

        // Always compute outstanding balance dynamically from ledger records
        const [ledgerSum] = await pool.execute(
            "SELECT COALESCE(SUM(amount), 0) as balance FROM partner_ledger WHERE partner_id = ?::uuid",
            [partner.id]
        );
        const outstanding = parseFloat(ledgerSum[0].balance);
        const limit = parseFloat(partner.credit_limit);
        const available = Math.max(0, limit - outstanding);

        res.json({
            success: true,
            credit_limit: limit,
            outstanding_balance: outstanding,
            available_credit: available
        });
    } catch (err) {
        console.error('API getCredit error:', err.message);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

module.exports = {
    getPlans,
    purchaseData,
    getTransactionStatus,
    getTransactions,
    getWallet,
    getCredit
};
