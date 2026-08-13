const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { placeDataOrder, checkOrderStatus, extractProviderId, getSourcingConfig } = require('../utils/sourcing');
const { logActivity } = require('../utils/activityLogger');
const { triggerTransactionWebhook } = require('../services/partnerWebhook.service');
const { sendExportResponse } = require('../utils/exportHelper');

// Purchase data bundle
const purchaseBundle = async (req, res) => {
    try {
        const { bundleId, recipientPhone } = req.body;
        const userId = req.user.id;
        const isAgent = req.user.role === 'agent' || req.user.role === 'superagent';

        if (!bundleId || !recipientPhone) {
            return res.status(400).json({ error: 'Bundle ID and recipient phone are required' });
        }

        // Check operating hours (7:00 AM - 10:00 PM)
        const hour = new Date().getHours();
        const isOffline = hour < 7 || hour >= 22;

        // Get bundle details (including default agent price and provider assignment)
        const [bundles] = await pool.execute(
            'SELECT id, network, data_amount, price_ghc, agent_price_ghc, is_active, provider_slug FROM data_bundles WHERE id = ?::uuid',
            [bundleId]
        );

        if (bundles.length === 0) {
            return res.status(404).json({ error: 'Bundle not found' });
        }

        const bundle = bundles[0];
        if (!bundle.is_active) {
            return res.status(400).json({ error: 'This data plan is currently disabled and unavailable for purchase' });
        }
        const originalPrice = parseFloat(bundle.price_ghc);

        // Determine final price based on user role and custom pricing
        let finalPrice = originalPrice;

        // Check for specific custom pricing first (available for any user if set by admin)
        const [customPricing] = await pool.execute(
            'SELECT custom_price FROM agent_pricing WHERE agent_id = ?::uuid AND bundle_id = ?::uuid',
            [userId, bundleId]
        );

        if (customPricing.length > 0) {
            // Use custom price set by admin for this specific user
            finalPrice = parseFloat(customPricing[0].custom_price);
        } else if (isAgent) {
            if (bundle.agent_price_ghc) {
                // Use default agent price from bundle
                finalPrice = parseFloat(bundle.agent_price_ghc);
            } else {
                // Fallback to 10% discount
                finalPrice = originalPrice * 0.9;
            }
        }

        // Get wallet balance
        const [profiles] = await pool.execute(
            'SELECT wallet_balance FROM profiles WHERE id = ?::uuid',
            [userId]
        );

        if (profiles.length === 0) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const walletBalance = parseFloat(profiles[0].wallet_balance);

        // Check sufficient balance
        if (walletBalance < finalPrice) {
            return res.status(400).json({ error: 'Insufficient wallet balance' });
        }

        // PRECHECK: Centralized MTN beneficiary validation BEFORE creating any order or deducting wallet
        const { validateBeneficiaryBeforeOrder } = require('../services/mtnValidation.service');
        const validation = await validateBeneficiaryBeforeOrder({
            network: bundle.network,
            recipientPhone: recipientPhone,
            bundleSize: bundle.data_amount,
            source: 'CUSTOMER',
            userId: req.user.id
        });

        if (!validation.allowed) {
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
                        phoneNumber: recipientPhone,
                        network: 'MTN',
                        status: 'pending',
                        pendingApproval: true
                    }
                });
            }
            return res.status(400).json({
                success: false,
                error: validation.error || 'Beneficiary validation failed'
            });
        }

        // Start transaction
        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            const transactionId = uuidv4();
            const sourcingConfig = await getSourcingConfig();
            const activeProviderSlug = sourcingConfig.active_sourcing_api || 'datahouse';
            const assignedProvider = bundle.provider_slug || activeProviderSlug;

            // Create transaction record with tracking columns
            const initialStatus = 'processing';
            await connection.execute(
                `INSERT INTO transactions 
                 (id, user_id, bundle_id, recipient_phone, amount_ghc, status, balance_before, balance_after, source, paid, source_provider) 
                 VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?, ?, ?, ?, 'web', 'yes', ?)`,
                [
                    transactionId, 
                    userId, 
                    bundleId, 
                    recipientPhone, 
                    finalPrice, 
                    initialStatus, 
                    walletBalance, 
                    walletBalance - finalPrice, 
                    assignedProvider
                ]
            );

            // Deduct from wallet in profiles table
            await connection.execute(
                'UPDATE profiles SET wallet_balance = wallet_balance - ? WHERE id = ?::uuid',
                [finalPrice, userId]
            );

            // Deduct from wallet in users table (redundant but necessary for sync)
            await connection.execute(
                'UPDATE users SET wallet_balance = wallet_balance - ? WHERE uuid = ?::uuid',
                [finalPrice, userId]
            );

            await connection.commit();

            // --- INLINE Order Placement ---
            let finalStatus = initialStatus;
            let apiResponse = null;

            if (!isOffline) {
                try {
                    console.log(`🚀 [PURCHASE] Placing order inline for ${transactionId}...`);
                    const fulfillment = await placeDataOrder({
                        network: bundle.network,
                        dataAmount: bundle.data_amount,
                        recipientPhone: recipientPhone,
                        transactionId: transactionId,
                        providerSlug: bundle.provider_slug
                    });

                    apiResponse = fulfillment.apiResponse || { error: fulfillment.message || fulfillment.error };

                    if (fulfillment.status === 'pending_mtn_approval') {
                        console.log(`📱 [PURCHASE] Provider returned pending_mtn_approval for ${transactionId}. Refunding wallet and purging order record.`);
                        
                        // 1. Record in MTN Beneficiary Approval system
                        const { recordPendingBeneficiary } = require('../services/mtnApproval.service');
                        await recordPendingBeneficiary({
                            phone: recipientPhone,
                            network: bundle.network,
                            bundleSize: bundle.data_amount,
                            source: 'Web App'
                        });

                        // 2. Refund wallet balance
                        await pool.execute('UPDATE profiles SET wallet_balance = wallet_balance + ? WHERE id = ?::uuid', [finalPrice, userId]);
                        await pool.execute('UPDATE users SET wallet_balance = wallet_balance + ? WHERE uuid = ?::uuid', [finalPrice, userId]);

                        // 3. Purge transaction so NO order record exists in transactions table
                        await pool.execute('DELETE FROM transactions WHERE id = ?::uuid', [transactionId]);

                        return res.status(422).json({
                            success: false,
                            code: 'BENEFICIARY_NOT_VALIDATED',
                            status: 'pending_mtn_approval',
                            message: 'Awaiting MTN Approval — This recipient\'s MTN number requires approval before data can be delivered.'
                        });
                    }

                    if (fulfillment.success) {
                        finalStatus = fulfillment.status; // 'completed' or 'processing'
                    } else if (fulfillment.apiResponse && fulfillment.status === 'failed') {
                        finalStatus = 'failed';
                    } else {
                        finalStatus = 'processing';
                    }

                    // Update transaction with DataHouse authoritative identifiers and tracking metadata
                    const dhOrderId = fulfillment.providerPublicId || fulfillment.providerOrderId || fulfillment.orderId || null;
                    const dhRefCode = fulfillment.providerReferenceCode || fulfillment.orderReference || null;
                    const dhStatus = fulfillment.status || finalStatus;

                    await pool.execute(
                        `UPDATE transactions 
                         SET status = ?, 
                             api_response = ?,
                             datahouse_order_id = COALESCE(?, datahouse_order_id),
                             reference_code = COALESCE(?, reference_code),
                             current_datahouse_status = ?,
                             mapped_bytebeacon_status = ?,
                             last_synced_at = CURRENT_TIMESTAMP,
                             sync_status = 'synced',
                             updated_at = CURRENT_TIMESTAMP 
                         WHERE id = ?::uuid`,
                        [finalStatus, JSON.stringify(apiResponse), dhOrderId, dhRefCode, dhStatus, finalStatus, transactionId]
                    );

                    let isRefunded = false;
                    if (finalStatus === 'failed') {
                        const { processAutomatedRefund } = require('../utils/refundHelper');
                        const refundRes = await processAutomatedRefund({
                            transactionId: transactionId,
                            userId: userId,
                            amountGhc: finalPrice,
                            reason: 'Inline order placement rejected by provider'
                        });
                        isRefunded = refundRes.success;
                    }

                    console.log(`✅ [PURCHASE] Order ${transactionId} placed inline: ${finalStatus}`);
                } catch (portalError) {
                    console.error(`❌ [PURCHASE] Portal-02 inline error for ${transactionId}:`, portalError.message);
                    // Order stays in 'processing' — cron job will retry
                }
            }

            // Emit socket event
            const io = req.app.get('io');
            if (io) {
                io.to(userId).emit('transactionUpdate', {
                    transactionId,
                    status: finalStatus,
                    message: finalStatus === 'completed'
                        ? 'Your data bundle has been delivered!'
                        : finalStatus === 'failed'
                            ? (isRefunded ? 'Data bundle delivery failed. Your wallet has been automatically refunded.' : 'Data bundle delivery failed. Please contact support.')
                            : 'Your order is being processed.'
                });
            }

            res.status(201).json({
                message: isOffline ? 'Order queued (Offline)'
                    : finalStatus === 'completed' ? 'Order completed successfully!'
                        : 'Order received and processing',
                transaction: {
                    id: transactionId,
                    network: bundle.network,
                    dataAmount: bundle.data_amount,
                    recipientPhone,
                    amount: finalPrice,
                    status: finalStatus,
                    isOffline
                }
            });

            // Log activity (non-blocking)
            logActivity(userId, 'PURCHASE', `${isOffline ? 'Queued' : 'Purchased'} ${bundle.data_amount} ${bundle.network} for ${recipientPhone}`, { transactionId, amount: finalPrice, network: bundle.network, isOffline }, req.ip);

        } catch (error) {
            if (connection) await connection.rollback().catch(() => { });
            throw error;
        } finally {
            if (connection) connection.release();
        }


    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ error: 'Purchase failed' });
    }
};

// Get user transactions
const getTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT t.id, t.recipient_phone, t.amount_ghc, t.status, t.created_at, t.updated_at,
                   t.serial_id, t.balance_before, t.balance_after, t.source, t.paid, t.source_provider,
                   d.network, d.data_amount
            FROM transactions t
            LEFT JOIN data_bundles d ON t.bundle_id = d.id::uuid
            WHERE t.user_id = ?::uuid AND t.status != 'pending_mtn_approval'
        `;
        const params = [userId];

        if (status) {
            query += ' AND t.status = ?';
            params.push(status);
        }

        query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [transactions] = await pool.execute(query, params);

        const formatted = transactions.map(t => ({
            id: t.id,
            recipientPhone: t.recipient_phone,
            amount: parseFloat(t.amount_ghc),
            status: t.status,
            network: t.network,
            dataAmount: t.data_amount,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            serialId: t.serial_id,
            balanceBefore: t.balance_before ? parseFloat(t.balance_before) : null,
            balanceAfter: t.balance_after ? parseFloat(t.balance_after) : null,
            source: t.source,
            paid: t.paid,
            sourceProvider: t.source_provider
        }));

        res.json(formatted);

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Failed to get transactions' });
    }
};

// Get single transaction
const getTransactionById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const [transactions] = await pool.execute(
            `SELECT t.*, d.network, d.data_amount 
             FROM transactions t 
             LEFT JOIN data_bundles d ON t.bundle_id = d.id::uuid 
             WHERE t.id = ?::uuid AND t.user_id = ?::uuid`,
            [id, userId]
        );

        if (transactions.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const t = transactions[0];
        res.json({
            id: t.id,
            recipientPhone: t.recipient_phone,
            amount: parseFloat(t.amount_ghc),
            status: t.status,
            network: t.network,
            dataAmount: t.data_amount,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            serialId: t.serial_id,
            balanceBefore: t.balance_before ? parseFloat(t.balance_before) : null,
            balanceAfter: t.balance_after ? parseFloat(t.balance_after) : null,
            source: t.source,
            paid: t.paid,
            sourceProvider: t.source_provider
        });

    } catch (error) {
        console.error('Get transaction error:', error);
        res.status(500).json({ error: 'Failed to get transaction' });
    }
};

// Sync transaction status with Portal-02
const syncTransactionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        // Get transaction details
        const [transactions] = await pool.execute(
            'SELECT t.*, d.network, d.data_amount FROM transactions t LEFT JOIN data_bundles d ON t.bundle_id = d.id::uuid WHERE t.id = ?::uuid',
            [id]
        );

        if (transactions.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const transaction = transactions[0];

        // Security: Only owner or admin can sync
        if (transaction.user_id !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Unauthorized to sync this transaction' });
        }

        // Only sync if not already completed/failed (or if admin wants to force refresh)
        if (transaction.status === 'completed' || transaction.status === 'failed') {
            return res.json({
                message: 'Transaction already in final state',
                status: transaction.status,
                synced: false
            });
        }

        // Block sync for unpaid transactions
        if (transaction.status === 'pending_payment') {
            return res.status(400).json({
                error: 'Cannot sync status for unpaid transactions'
            });
        }

        console.log(`🔄 Syncing status for transaction ${id}...`);

        // Detect which provider was used from api_response metadata
        let providerName = null;
        try {
            let apiData = transaction.api_response;
            if (typeof apiData === 'string') apiData = JSON.parse(apiData);
            providerName = apiData?.provider || transaction.source_provider || null;
        } catch (e) {}

        // Parse api_response to get provider's orderId or reference
        let providerIdentifier = extractProviderId(transaction.api_response, id, transaction.recipient_phone, providerName);

        if (providerIdentifier !== id) {
            console.log(`🔍 Found provider identifier: ${providerIdentifier}`);
        }

        // Check status with the correct provider (not just the currently active one)
        const result = await checkOrderStatus(providerIdentifier, providerName);

        if (!result.success) {
            return res.status(400).json({
                error: 'Failed to sync with provider',
                details: result.error,
                synced: false,
                identifierUsed: providerIdentifier
            });
        }

        const newStatus = result.status;
        const portalStatus = result.portalStatus;

        // If status changed, update database
        if (newStatus !== transaction.status) {
            console.log(`✅ Status changed for ${id}: ${transaction.status} -> ${newStatus} (Portal: ${portalStatus})`);

            // Merge existing api_response to preserve metadata like provider and orderId
            let existingData = {};
            try {
                existingData = typeof transaction.api_response === 'string'
                    ? JSON.parse(transaction.api_response || '{}')
                    : (transaction.api_response || {});
            } catch (e) { }

            const mergedResponse = {
                ...existingData,
                ...(result.order || result),
                lastCycleSync: new Date().toISOString(),
                portalStatus: portalStatus
            };

            await pool.execute(
                'UPDATE transactions SET status = ?, api_response = ? WHERE id = ?::uuid',
                [newStatus, JSON.stringify(mergedResponse), id]
            );

            let isRefunded = false;
            if (newStatus === 'failed') {
                const { processAutomatedRefund } = require('../utils/refundHelper');
                const refundRes = await processAutomatedRefund({
                    transactionId: id,
                    userId: transaction.user_id,
                    reason: 'Manual status sync detected delivery failure'
                });
                isRefunded = refundRes.success;
            }

            // Trigger partner webhook if applicable
            triggerTransactionWebhook(id, newStatus).catch(() => {});

            // Emit socket event
            const io = req.app.get('io');
            if (io) {
                io.to(transaction.user_id).emit('transactionUpdate', {
                    transactionId: id,
                    status: newStatus,
                    message: newStatus === 'completed'
                        ? 'Your data bundle has been delivered!'
                        : newStatus === 'failed'
                            ? (isRefunded ? 'Data bundle delivery failed. Your wallet has been automatically refunded.' : 'Data bundle delivery failed. Please contact support.')
                            : `Status updated to ${newStatus} via manual sync.`
                });
            }

            return res.json({
                message: 'Status updated successfully',
                oldStatus: transaction.status,
                newStatus: newStatus,
                portalStatus: portalStatus,
                synced: true
            });
        }

        res.json({
            message: 'Status is still up to date',
            status: transaction.status,
            portalStatus: portalStatus,
            synced: true
        });

    } catch (error) {
        console.error('Sync transaction status error:', error);
        res.status(500).json({ error: 'Failed to sync status' });
    }
};

// Export user's transactions / orders matching filters
const exportUserTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, network, timeframe, startDate, endDate, search, format = 'csv' } = req.query;

        const safeFormat = ['csv', 'excel', 'xlsx', 'json'].includes(String(format).toLowerCase())
            ? String(format).toLowerCase()
            : 'csv';

        let query = `
            SELECT t.id, t.recipient_phone, t.amount_ghc, t.status, t.created_at, t.updated_at,
                   t.serial_id, t.balance_before, t.balance_after, t.source, t.paid, t.source_provider,
                   d.network, d.data_amount
            FROM transactions t
            LEFT JOIN data_bundles d ON t.bundle_id = d.id::uuid
            WHERE t.user_id = ?::uuid AND t.status != 'pending_mtn_approval'
        `;
        const params = [userId];

        if (status && status !== 'all') {
            if (status === 'processing') {
                query += " AND t.status IN ('processing', 'pending', 'ongoing', 'queued')";
            } else {
                query += ' AND t.status = ?';
                params.push(status);
            }
        }

        if (network && network !== 'all') {
            const net = network.toLowerCase();
            if (net === 'mtn') {
                query += " AND LOWER(d.network) LIKE '%mtn%'";
            } else if (net === 'telecel' || net === 'voda') {
                query += " AND (LOWER(d.network) LIKE '%telecel%' OR LOWER(d.network) LIKE '%voda%')";
            } else if (net === 'at' || net === 'airteltigo') {
                query += " AND (LOWER(d.network) LIKE '%at%' OR LOWER(d.network) LIKE '%airtel%')";
            } else {
                query += ' AND LOWER(d.network) LIKE ?';
                params.push(`%${net}%`);
            }
        }

        if (timeframe && timeframe !== 'all') {
            if (timeframe === 'today') {
                query += ' AND t.created_at >= CURRENT_DATE';
            } else {
                let intervalDays = 0;
                if (timeframe === '7d' || timeframe === 'week') intervalDays = 7;
                else if (timeframe === '30d' || timeframe === 'month') intervalDays = 30;
                else if (timeframe === '90d') intervalDays = 90;
                else if (timeframe === '1y') intervalDays = 365;

                if (intervalDays > 0) {
                    query += ` AND t.created_at >= NOW() - (${intervalDays} * INTERVAL '1 day')`;
                }
            }
        }

        if (startDate) {
            query += ' AND t.created_at >= ?::timestamp';
            params.push(new Date(startDate).toISOString());
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query += ' AND t.created_at <= ?::timestamp';
            params.push(end.toISOString());
        }

        if (search && search.trim() !== '') {
            const term = `%${search.trim()}%`;
            query += ` AND (
                t.recipient_phone LIKE ? 
                OR t.id::text LIKE ? 
                OR (t.serial_id IS NOT NULL AND t.serial_id::text LIKE ?)
                OR d.network ILIKE ?
                OR d.data_amount ILIKE ?
            )`;
            params.push(term, term, term, term, term);
        }

        query += ' ORDER BY t.created_at DESC LIMIT 50000';

        const [rows] = await pool.execute(query, params);

        const columns = [
            {
                key: 'serial_id',
                label: 'Order ID',
                transform: (r) => r.serial_id ? `ORD-${r.serial_id}` : (r.id ? `ORD-${r.id.slice(0, 8).toUpperCase()}` : 'N/A')
            },
            { key: 'id', label: 'Reference ID' },
            { key: 'recipient_phone', label: 'Recipient Phone' },
            { key: 'network', label: 'Network' },
            { key: 'data_amount', label: 'Bundle Size' },
            {
                key: 'amount_ghc',
                label: 'Amount (GH₵)',
                transform: (r) => r.amount_ghc !== null && r.amount_ghc !== undefined ? parseFloat(r.amount_ghc) : 0
            },
            { key: 'status', label: 'Status' },
            { key: 'paid', label: 'Paid' },
            { key: 'source', label: 'Channel' },
            {
                key: 'balance_before',
                label: 'Bal. Before (GH₵)',
                transform: (r) => r.balance_before !== null && r.balance_before !== undefined ? parseFloat(r.balance_before) : ''
            },
            {
                key: 'balance_after',
                label: 'Bal. After (GH₵)',
                transform: (r) => r.balance_after !== null && r.balance_after !== undefined ? parseFloat(r.balance_after) : ''
            },
            {
                key: 'created_at',
                label: 'Date Placed',
                transform: (r) => r.created_at ? new Date(r.created_at).toISOString() : ''
            },
            {
                key: 'updated_at',
                label: 'Last Updated',
                transform: (r) => r.updated_at ? new Date(r.updated_at).toISOString() : ''
            }
        ];

        return sendExportResponse(res, {
            data: rows,
            columns,
            filename: 'bytebeacon_my_orders',
            format: safeFormat,
            sheetName: 'My Orders'
        });

    } catch (error) {
        console.error('Export user transactions error:', error);
        return res.status(500).json({ error: 'Failed to export transactions' });
    }
};

module.exports = {
    purchaseBundle,
    getTransactions,
    getTransactionById,
    syncTransactionStatus,
    exportUserTransactions
};
