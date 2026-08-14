const { v4: uuidv4, validate: uuidValidate } = require('uuid');
const pool = require('../config/database');
const {
    createSingleOrder,
    getOrderById: getDhOrderById,
    getBundleById: getDhBundleById,
    translateDataHouseError,
    normalizePhone
} = require('../integrations/datahouse');
const { logActivity } = require('../utils/activityLogger');
const { triggerTransactionWebhook } = require('../services/partnerWebhook.service');
const { sendExportResponse } = require('../utils/exportHelper');

/**
 * Purchase Data Bundle
 * Architecture: ByteBeacon validates customer & forwards directly to DataHouse as the sole authority.
 */
const purchaseBundle = async (req, res) => {
    try {
        const { bundleId, recipientPhone } = req.body;
        const userId = req.user.id;
        const isAgent = req.user.role === 'agent' || req.user.role === 'superagent';

        if (!bundleId || !recipientPhone) {
            return res.status(400).json({ error: 'Bundle ID and recipient phone are required' });
        }

        const cleanPhone = normalizePhone(recipientPhone);
        if (!cleanPhone || cleanPhone.length < 10) {
            return res.status(400).json({ error: 'Please provide a valid Ghanaian phone number' });
        }

        // 1. Fetch authoritative bundle from DataHouse (or local cache fallback)
        let bundle = await getDhBundleById(bundleId);
        let network = bundle?.network || 'MTN';
        let dataAmount = bundle?.dataVolume || '1GB';
        let originalPrice = bundle ? (bundle.amount || bundle.agentAmount) : 0;
        let agentPrice = bundle ? (bundle.agentAmount || bundle.amount) : 0;

        if (!bundle) {
            const [dbBundles] = await pool.execute(
                'SELECT * FROM data_bundles WHERE id::text = ? OR id::text = ?::uuid',
                [bundleId, bundleId]
            ).catch(async () => {
                return await pool.execute('SELECT * FROM data_bundles WHERE id::text = ?', [bundleId]);
            });

            if (dbBundles.length > 0) {
                const b = dbBundles[0];
                network = b.network;
                dataAmount = b.data_amount;
                originalPrice = parseFloat(b.price_ghc);
                agentPrice = parseFloat(b.agent_price_ghc || b.price_ghc);
            } else {
                return res.status(404).json({ error: 'Data bundle not found or no longer available' });
            }
        }

        // 2. Determine final price based on user role
        let finalPrice = isAgent ? agentPrice : originalPrice;

        // Check for custom pricing override if set by admin
        const [customPricing] = await pool.execute(
            `SELECT ap.custom_price 
             FROM agent_pricing ap 
             LEFT JOIN data_bundles db ON ap.bundle_id = db.id 
             WHERE ap.agent_id = ?::uuid 
               AND (ap.bundle_id::text = ? OR (LOWER(TRIM(db.network)) = LOWER(TRIM(?)) AND LOWER(TRIM(db.data_amount)) = LOWER(TRIM(?))))
             LIMIT 1`,
            [userId, String(bundleId), network || '', dataAmount || '']
        ).catch(() => [[]]);

        if (customPricing.length > 0) {
            finalPrice = parseFloat(customPricing[0].custom_price);
        }

        // 3. Verify Customer Wallet Balance
        const [profiles] = await pool.execute(
            'SELECT wallet_balance FROM profiles WHERE id = ?::uuid',
            [userId]
        );

        if (profiles.length === 0) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const walletBalance = parseFloat(profiles[0].wallet_balance);
        if (walletBalance < finalPrice) {
            return res.status(400).json({
                error: `Insufficient wallet balance. Order requires GH₵ ${finalPrice.toFixed(2)}, current balance is GH₵ ${walletBalance.toFixed(2)}`
            });
        }

        // 4. Generate Idempotency Key (UUID v4)
        const transactionId = uuidv4();

        // 5. Forward Order Directly to DataHouse API
        const dhResponse = await createSingleOrder({
            bundleId: bundle?.id || bundleId,
            phoneNumber: cleanPhone,
            idempotencyKey: transactionId,
            email: req.user.email || 'orders@bytebeacon.com'
        });

        // 6. Handle DataHouse Rejection / Error
        if (!dhResponse.ok) {
            const translated = translateDataHouseError(dhResponse.error, dhResponse.correlationId);

            console.warn(`⚠️ [PURCHASE REJECTED] DataHouse returned HTTP ${dhResponse.status}:`, dhResponse.error);

            // If MTN number requires Up2U approval, relay exact code
            if (translated.code === 'BENEFICIARY_NOT_VALIDATED') {
                return res.status(422).json({
                    success: false,
                    code: 'BENEFICIARY_NOT_VALIDATED',
                    status: 'pending_mtn_approval',
                    message: translated.message,
                    error: {
                        code: 'BENEFICIARY_NOT_VALIDATED',
                        message: translated.message
                    },
                    data: {
                        phoneNumber: cleanPhone,
                        network: 'MTN',
                        status: 'pending',
                        pendingApproval: true
                    }
                });
            }

            return res.status(dhResponse.status || 400).json({
                success: false,
                code: translated.code,
                error: translated.message,
                message: translated.message,
                correlationId: translated.correlationId
            });
        }

        // 7. DataHouse Accepted the Order — Persist Synchronized Reference Record & Deduct Wallet
        const dhData = dhResponse.data || {};
        const dhOrderId = dhData.id || dhData.publicId || null;
        const dhPublicId = dhData.publicId || dhData.id || null;
        const dhRefCode = dhData.referenceCode || dhData.reference || null;
        const dhStatus = dhData.status || 'received';

        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // Deduct from wallet
            await connection.execute(
                'UPDATE profiles SET wallet_balance = wallet_balance - ? WHERE id = ?::uuid',
                [finalPrice, userId]
            );
            await connection.execute(
                'UPDATE users SET wallet_balance = wallet_balance - ? WHERE uuid = ?::uuid',
                [finalPrice, userId]
            ).catch(() => {});

            // Insert reference record
            await connection.execute(
                `INSERT INTO transactions 
                 (id, user_id, bundle_id, recipient_phone, amount_ghc, status, balance_before, balance_after, source, paid, source_provider,
                  datahouse_order_id, reference_code, current_datahouse_status, mapped_bytebeacon_status, sync_status, last_synced_at, api_response) 
                 VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?, ?, ?, ?, 'web', 'yes', 'datahouse', ?, ?, ?, ?, 'synced', CURRENT_TIMESTAMP, ?::jsonb)`,
                [
                    transactionId,
                    userId,
                    (uuidValidate(bundleId) ? bundleId : null),
                    cleanPhone,
                    finalPrice,
                    dhStatus,
                    walletBalance,
                    walletBalance - finalPrice,
                    dhOrderId,
                    dhRefCode,
                    dhStatus,
                    dhStatus,
                    JSON.stringify(dhData)
                ]
            );

            await connection.commit();
        } catch (dbErr) {
            if (connection) await connection.rollback().catch(() => {});
            console.error('❌ Database save error after DataHouse order placement:', dbErr.message);
            throw dbErr;
        } finally {
            if (connection) connection.release();
        }

        // 8. Real-time Socket.IO Event
        const io = req.app.get('io') || global.io;
        if (io) {
            io.to(userId).emit('transactionUpdate', {
                transactionId,
                publicId: dhPublicId,
                referenceCode: dhRefCode,
                status: dhStatus,
                message: dhStatus === 'approved'
                    ? 'Your data bundle has been approved and delivered!'
                    : 'Your order has been received by DataHouse and is processing.'
            });
        }

        // 9. Return Authoritative Order Response
        res.status(201).json({
            success: true,
            message: 'Order received and submitted to DataHouse',
            transaction: {
                id: transactionId,
                publicId: dhPublicId,
                referenceCode: dhRefCode,
                network,
                dataAmount,
                recipientPhone: cleanPhone,
                amount: finalPrice,
                status: dhStatus,
                createdAt: new Date().toISOString()
            }
        });

        // 10. Non-blocking Activity Log
        logActivity(
            userId,
            'PURCHASE',
            `Purchased ${dataAmount} ${network} for ${cleanPhone} via DataHouse (Ref: ${dhRefCode || transactionId.slice(0, 8)})`,
            { transactionId, publicId: dhPublicId, referenceCode: dhRefCode, amount: finalPrice, network },
            req.ip
        );

    } catch (error) {
        console.error('❌ Purchase Controller Exception:', error);
        res.status(500).json({ error: 'Purchase processing failed: ' + error.message });
    }
};

/**
 * Get User Transactions History
 */
const getTransactions = async (req, res) => {
    try {
        const { parsePagination, buildPaginatedResponse } = require('../utils/pagination');
        const userId = req.user.id;
        const { status, network, search } = req.query;
        const { page, limit, offset, sortSql } = parsePagination(req.query, {
            defaultPage: 1,
            defaultLimit: 25,
            maxLimit: 100,
            allowedSortFields: {
                createdAt: 't.created_at',
                updatedAt: 't.updated_at',
                amount: 't.amount_ghc',
                status: 't.status',
                network: 'd.network'
            },
            defaultSort: 't.created_at DESC'
        });

        let baseFromWhere = `
            FROM transactions t
            LEFT JOIN data_bundles d ON t.bundle_id = d.id::uuid
            WHERE t.user_id = ?::uuid
        `;
        const params = [userId];

        if (status && status !== 'all') {
            baseFromWhere += ' AND (t.status = ? OR t.current_datahouse_status = ?)';
            params.push(status, status);
        }

        if (network && network !== 'all') {
            baseFromWhere += ' AND LOWER(d.network) LIKE ?';
            params.push(`%${network.toLowerCase()}%`);
        }

        if (search && search.trim() !== '') {
            const term = `%${search.trim()}%`;
            baseFromWhere += ` AND (
                t.recipient_phone LIKE ?
                OR t.datahouse_order_id ILIKE ?
                OR t.reference_code ILIKE ?
                OR (t.serial_id IS NOT NULL AND t.serial_id::text LIKE ?)
            )`;
            params.push(term, term, term, term);
        }

        // 1. Total Count
        const countQuery = `SELECT COUNT(*) as total ${baseFromWhere}`;
        const [countRows] = await pool.execute(countQuery, params);
        const total = parseInt(countRows[0]?.total || 0, 10);

        // 2. Paginated Data
        const dataQuery = `
            SELECT t.id, t.recipient_phone, t.amount_ghc, t.status, t.created_at, t.updated_at,
                   t.serial_id, t.balance_before, t.balance_after, t.source, t.paid, t.source_provider,
                   t.datahouse_order_id, t.reference_code, t.current_datahouse_status, t.last_synced_at,
                   d.network, d.data_amount
            ${baseFromWhere}
            ORDER BY ${sortSql}
            LIMIT ? OFFSET ?
        `;
        const dataParams = [...params, limit, offset];
        const [transactions] = await pool.execute(dataQuery, dataParams);

        const formatted = transactions.map(t => ({
            id: t.id,
            publicId: t.datahouse_order_id || t.id,
            referenceCode: t.reference_code || `ORD-${t.serial_id || t.id.slice(0, 8)}`,
            recipientPhone: t.recipient_phone,
            amount: parseFloat(t.amount_ghc),
            status: t.current_datahouse_status || t.status,
            network: t.network || 'MTN',
            dataAmount: t.data_amount || 'N/A',
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            lastSyncedAt: t.last_synced_at,
            serialId: t.serial_id,
            balanceBefore: t.balance_before ? parseFloat(t.balance_before) : null,
            balanceAfter: t.balance_after ? parseFloat(t.balance_after) : null,
            source: t.source,
            paid: t.paid,
            sourceProvider: 'datahouse'
        }));

        if (req.query.legacy === 'true') {
            return res.json(formatted);
        }

        res.json(buildPaginatedResponse(formatted, total, page, limit));
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Failed to get transactions' });
    }
};

/**
 * Get Single Transaction by ID (Reconciles with DataHouse if applicable)
 */
const getTransactionById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const [transactions] = await pool.execute(
            `SELECT t.*, d.network, d.data_amount 
             FROM transactions t 
             LEFT JOIN data_bundles d ON t.bundle_id = d.id::uuid 
             WHERE (t.id::text = ? OR t.datahouse_order_id = ? OR t.reference_code = ?) AND t.user_id = ?::uuid`,
            [id, id, id, userId]
        );

        if (transactions.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const t = transactions[0];
        let currentStatus = t.current_datahouse_status || t.status;

        // Passive reconciliation: if order is still in transient state, check DataHouse
        if (['received', 'processing', 'ongoing'].includes(currentStatus) && (t.datahouse_order_id || t.reference_code)) {
            const dhRes = await getDhOrderById(t.datahouse_order_id || t.reference_code);
            if (dhRes.ok && dhRes.data?.status) {
                const freshStatus = dhRes.data.status;
                if (freshStatus !== currentStatus) {
                    currentStatus = freshStatus;
                    await pool.execute(
                        `UPDATE transactions SET status = ?, current_datahouse_status = ?, last_synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid`,
                        [freshStatus, freshStatus, t.id]
                    ).catch(() => {});
                }
            }
        }

        res.json({
            id: t.id,
            publicId: t.datahouse_order_id || t.id,
            referenceCode: t.reference_code || `ORD-${t.serial_id || t.id.slice(0, 8)}`,
            recipientPhone: t.recipient_phone,
            amount: parseFloat(t.amount_ghc),
            status: currentStatus,
            network: t.network || 'MTN',
            dataAmount: t.data_amount || 'N/A',
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            lastSyncedAt: t.last_synced_at,
            serialId: t.serial_id,
            balanceBefore: t.balance_before ? parseFloat(t.balance_before) : null,
            balanceAfter: t.balance_after ? parseFloat(t.balance_after) : null,
            source: t.source,
            paid: t.paid,
            sourceProvider: 'datahouse'
        });

    } catch (error) {
        console.error('Get transaction error:', error);
        res.status(500).json({ error: 'Failed to get transaction' });
    }
};

/**
 * Explicit Sync of Transaction Status with DataHouse
 */
const syncTransactionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        const [transactions] = await pool.execute(
            `SELECT t.*, d.network, d.data_amount 
             FROM transactions t 
             LEFT JOIN data_bundles d ON t.bundle_id = d.id::uuid 
             WHERE t.id::text = ? OR t.datahouse_order_id = ? OR t.reference_code = ?`,
            [id, id, id]
        );

        if (transactions.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const transaction = transactions[0];

        if (transaction.user_id !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Unauthorized to sync this transaction' });
        }

        const dhIdentifier = transaction.datahouse_order_id || transaction.reference_code || transaction.id;
        const dhRes = await getDhOrderById(dhIdentifier);

        if (!dhRes.ok) {
            return res.status(400).json({
                error: 'Could not retrieve authoritative order status from DataHouse',
                details: dhRes.error
            });
        }

        const dhOrder = dhRes.data || {};
        const freshStatus = dhOrder.status || transaction.status;

        await pool.execute(
            `UPDATE transactions 
             SET status = ?, 
                 current_datahouse_status = ?,
                 mapped_bytebeacon_status = ?,
                 datahouse_order_id = COALESCE(?, datahouse_order_id),
                 reference_code = COALESCE(?, reference_code),
                 last_synced_at = CURRENT_TIMESTAMP,
                 sync_status = 'synced',
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?::uuid`,
            [freshStatus, freshStatus, freshStatus, dhOrder.id || dhOrder.publicId, dhOrder.referenceCode || dhOrder.reference, transaction.id]
        );

        const io = req.app.get('io') || global.io;
        if (io) {
            io.to(transaction.user_id).emit('transactionUpdate', {
                transactionId: transaction.id,
                status: freshStatus,
                message: `Status synchronized with DataHouse: ${freshStatus}`
            });
        }

        res.json({
            message: 'Transaction synchronized with DataHouse',
            status: freshStatus,
            synced: true,
            datahouseOrder: dhOrder
        });

    } catch (error) {
        console.error('Sync transaction error:', error);
        res.status(500).json({ error: 'Failed to sync transaction status: ' + error.message });
    }
};

/**
 * Export User Transactions
 */
const exportUserTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
        const { format = 'csv', status, search } = req.query;

        let query = `
            SELECT t.id, t.recipient_phone, t.amount_ghc, t.status, t.created_at,
                   t.serial_id, t.datahouse_order_id, t.reference_code, t.current_datahouse_status,
                   d.network, d.data_amount
            FROM transactions t
            LEFT JOIN data_bundles d ON t.bundle_id = d.id::uuid
            WHERE t.user_id = ?::uuid
        `;
        const params = [userId];

        if (status && status !== 'all') {
            query += ' AND (t.status = ? OR t.current_datahouse_status = ?)';
            params.push(status, status);
        }

        if (search && search.trim() !== '') {
            query += ' AND (t.recipient_phone LIKE ? OR t.reference_code LIKE ? OR d.network LIKE ?)';
            const term = `%${search.trim()}%`;
            params.push(term, term, term);
        }

        query += ' ORDER BY t.created_at DESC LIMIT 5000';

        const [rows] = await pool.execute(query, params);

        const exportColumns = [
            { key: 'reference_code', label: 'Order Reference', transform: (r) => r.reference_code || `ORD-${r.serial_id || r.id.slice(0, 8)}` },
            { key: 'recipient_phone', label: 'Recipient Phone' },
            { key: 'network', label: 'Network', transform: (r) => r.network || 'MTN' },
            { key: 'data_amount', label: 'Data Volume', transform: (r) => r.data_amount || 'N/A' },
            { key: 'amount_ghc', label: 'Amount (GH₵)', transform: (r) => parseFloat(r.amount_ghc || 0) },
            { key: 'status', label: 'Status', transform: (r) => r.current_datahouse_status || r.status },
            { key: 'created_at', label: 'Date', transform: (r) => r.created_at ? new Date(r.created_at).toISOString() : '' }
        ];

        sendExportResponse(res, {
            data: rows,
            columns: exportColumns,
            filename: `my_orders_${Date.now()}`,
            format,
            sheetName: 'My Orders'
        });

    } catch (error) {
        console.error('Export user transactions error:', error);
        res.status(500).json({ error: 'Failed to export transactions' });
    }
};

module.exports = {
    purchaseBundle,
    getTransactions,
    getTransactionById,
    syncTransactionStatus,
    exportUserTransactions
};
