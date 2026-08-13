const pool = require('../config/database');
const { checkOrderStatus, extractProviderId } = require('../utils/sourcing');
const { isValidStatusTransition } = require('../utils/statusMapper');
const { processWebhookQueue, triggerTransactionWebhook } = require('../services/partnerWebhook.service');

/**
 * Background job to sync transaction statuses with Datahouse
 * This ensures orders get updated even if webhooks fail
 */

// Orders placed before this date were fulfilled via Portal-02 (now decommissioned).
// The new Datahouse API has no knowledge of those orders, so we skip them.
const DATAHOUSE_MIGRATION_DATE = '2026-07-01T00:00:00Z';

let isRunning = false;

const syncPendingTransactions = async (io) => {
    // Prevent concurrent runs
    if (isRunning) {
        console.log('⏳ Status sync job already running, skipping...');
        return;
    }

    isRunning = true;
    console.log('🔄 Starting background status sync + queue processing...');

    try {
        // --- PASS 0: Mark pre-migration Portal-02 orders as failed ---
        try {
            const [legacyOrders] = await pool.execute(`
                UPDATE transactions
                SET status = 'failed',
                    failure_reason = 'Provider migrated — this order was placed on the legacy Portal-02 system which is no longer active.',
                    updated_at = CURRENT_TIMESTAMP
                WHERE status IN ('processing', 'ongoing', 'queued', 'pending')
                AND created_at < ?
                RETURNING id, user_id
            `, [DATAHOUSE_MIGRATION_DATE]);

            if (legacyOrders.length > 0) {
                console.log(`🧹 [MIGRATION] Marked ${legacyOrders.length} pre-migration Portal-02 orders as failed.`);
                if (io) {
                    for (const order of legacyOrders) {
                        io.to(order.user_id).emit('transactionUpdate', {
                            transactionId: order.id,
                            status: 'failed',
                            message: 'This order was placed on our previous provider and could not be fulfilled. Please contact support.'
                        });
                    }
                }
            }
        } catch (migrationErr) {
            console.error('❌ [SYNC JOB] Legacy order cleanup error:', migrationErr.message);
        }

        // --- PASS 1: Process New/Pending Orders in Queue ---
        try {
            const { processOrderQueue } = require('../services/orderQueue.service');
            await processOrderQueue(io);
        } catch (queueErr) {
            console.error('❌ [SYNC JOB] Queue processing error:', queueErr.message);
        }

        // --- PASS 2: Sync Status for Ongoing/Processing Transactions ---
        const [transactions] = await pool.execute(`
            SELECT t.id, t.user_id, t.status, t.api_response, t.created_at, t.recipient_phone
            FROM transactions t
            WHERE t.status IN ('processing', 'ongoing', 'queued', 'pending')
            AND t.created_at >= ?
            AND t.created_at < NOW() - INTERVAL '5 seconds'
            ORDER BY t.created_at ASC
            LIMIT 50
        `, [DATAHOUSE_MIGRATION_DATE]);

        if (transactions.length > 0) {
            console.log(`📋 Found ${transactions.length} transactions to check`);

            for (const transaction of transactions) {
                try {
                    let providerName = null;
                    try {
                        let apiData = transaction.api_response;
                        if (typeof apiData === 'string') apiData = JSON.parse(apiData);
                        providerName = apiData?.provider || null;
                    } catch (e) {}

                    let providerIdentifier = extractProviderId(transaction.api_response, transaction.id, transaction.recipient_phone, providerName);

                    console.log(`🔍 Checking status for ${transaction.id} (provider: ${providerName || 'auto'}, identifier: ${providerIdentifier})`);

                    const result = await checkOrderStatus(providerIdentifier, providerName);

                    if (!result.success) {
                        console.warn(`[ORDER_SYNC_ERROR] Order: ${transaction.id} | Provider Ref: ${providerIdentifier} | Error: ${result.error} | Action: retrying next cycle`);
                        continue; // Keep order in processing status, retry on next cycle
                    }

                    const newStatus = result.status;

                    if (newStatus !== transaction.status && isValidStatusTransition(transaction.status, newStatus)) {
                        console.log(`[ORDER_SYNC] Order: ${transaction.id} | Provider Ref: ${providerIdentifier} | Previous: ${transaction.status} | DataHouse Status: ${result.portalStatus} | New Status: ${newStatus} | Result: synchronized`);

                        let existingData = {};
                        try {
                            existingData = typeof transaction.api_response === 'string'
                                ? JSON.parse(transaction.api_response || '{}')
                                : (transaction.api_response || {});
                        } catch (e) {}

                        const mergedResponse = {
                            ...existingData,
                            ...(result.order || result),
                            lastCycleSync: new Date().toISOString(),
                            portalStatus: result.portalStatus
                        };

                        const dhOrderId = mergedResponse?.data?.id || mergedResponse?.data?.publicId || mergedResponse?.orderId || null;
                        const dhRefCode = mergedResponse?.data?.referenceCode || mergedResponse?.providerReferenceCode || null;

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
                            [newStatus, JSON.stringify(mergedResponse), dhOrderId, dhRefCode, result.portalStatus || newStatus, newStatus, transaction.id]
                        );

                        let isRefunded = false;
                        if (newStatus === 'failed' || newStatus === 'rejected') {
                            const { processAutomatedRefund } = require('../utils/refundHelper');
                            const refundRes = await processAutomatedRefund({
                                transactionId: transaction.id,
                                userId: transaction.user_id,
                                reason: `Background status sync detected status: ${newStatus}`
                            });
                            isRefunded = refundRes.success;
                        }

                        if (io) {
                            io.to(transaction.user_id).emit('transactionUpdate', {
                                transactionId: transaction.id,
                                status: newStatus,
                                message: newStatus === 'completed'
                                    ? 'Your data bundle has been delivered!'
                                    : (newStatus === 'failed' || newStatus === 'rejected')
                                        ? (isRefunded ? 'Data bundle delivery failed. Your wallet has been automatically refunded.' : 'Data bundle delivery failed. Please contact support.')
                                        : 'Your order status has been updated.'
                            });
                        }

                        triggerTransactionWebhook(transaction.id, newStatus).catch(() => {});
                    }
                } catch (err) {
                    console.error(`❌ Error syncing transaction ${transaction.id}:`, err.message);
                }

                await new Promise(resolve => setTimeout(resolve, 300));
            }

            console.log('✅ Background status sync completed for main transactions');
        }

        // --- PASS 2.5: Sync Status for Ongoing Agent Storefront Orders ---
        try {
            const [agentOrders] = await pool.execute(`
                SELECT id, agent_id, store_id, customer_phone, profit_ghc, fulfillment_status, api_response, created_at
                FROM agent_orders
                WHERE fulfillment_status IN ('processing', 'pending', 'ongoing')
                AND created_at >= ?
                AND created_at < NOW() - INTERVAL '5 seconds'
                ORDER BY created_at ASC
                LIMIT 50
            `, [DATAHOUSE_MIGRATION_DATE]);

            if (agentOrders.length > 0) {
                console.log(`📋 Found ${agentOrders.length} storefront agent orders to check`);
                for (const ao of agentOrders) {
                    try {
                        let providerIdentifier = extractProviderId(ao.api_response, ao.id, ao.customer_phone);
                        const result = await checkOrderStatus(providerIdentifier);

                        if (!result.success) {
                            console.warn(`[ORDER_SYNC_ERROR] Agent Order: ${ao.id} | Provider Ref: ${providerIdentifier} | Error: ${result.error} | Action: retrying next cycle`);
                            continue;
                        }

                        if (result.status !== 'processing' && isValidStatusTransition(ao.fulfillment_status, result.status)) {
                            const newStatus = result.status === 'completed' ? 'completed' : 'refunded';
                            console.log(`[ORDER_SYNC] Agent Order: ${ao.id} | Provider Ref: ${providerIdentifier} | Previous: ${ao.fulfillment_status} | DataHouse Status: ${result.portalStatus} | New Status: ${newStatus} | Result: synchronized`);

                            let aoApiData = {};
                            try {
                                aoApiData = typeof ao.api_response === 'string' ? JSON.parse(ao.api_response || '{}') : (ao.api_response || {});
                            } catch (e) {}
                            const aoDhOrderId = aoApiData?.data?.id || aoApiData?.data?.publicId || aoApiData?.orderId || null;
                            const aoDhRefCode = aoApiData?.data?.referenceCode || aoApiData?.providerReferenceCode || null;

                            await pool.execute(
                                `UPDATE agent_orders 
                                 SET fulfillment_status = ?,
                                     datahouse_order_id = COALESCE(?, datahouse_order_id),
                                     reference_code = COALESCE(?, reference_code),
                                     current_datahouse_status = ?,
                                     mapped_bytebeacon_status = ?,
                                     last_synced_at = CURRENT_TIMESTAMP,
                                     sync_status = 'synced',
                                     updated_at = NOW() 
                                 WHERE id = ?::uuid`,
                                [newStatus, aoDhOrderId, aoDhRefCode, result.portalStatus || newStatus, newStatus, ao.id]
                            );

                            // Credit agent profit on completed storefront order if not previously completed
                            if (newStatus === 'completed' && ao.fulfillment_status !== 'completed') {
                                const profitGhc = parseFloat(ao.profit_ghc || 0);
                                if (profitGhc > 0 && ao.agent_id) {
                                    await pool.execute(
                                        `UPDATE agent_wallets 
                                         SET available_balance = available_balance + ?,
                                             total_profit_earned = total_profit_earned + ?,
                                             updated_at = NOW()
                                         WHERE agent_id = ?::uuid`,
                                        [profitGhc, profitGhc, ao.agent_id]
                                    ).catch(err => console.error('Error crediting agent profit during sync:', err));
                                }
                            }

                            if (io && ao.agent_id) {
                                io.to(ao.agent_id).emit('agentOrderUpdate', {
                                    orderId: ao.id,
                                    status: newStatus,
                                    message: `Storefront order status updated to ${newStatus}`
                                });
                            }
                        }
                    } catch (aoErr) {
                        console.error(`❌ Error syncing agent order ${ao.id}:`, aoErr.message);
                    }
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
        } catch (aoSyncErr) {
            console.error('❌ [SYNC JOB] Agent orders sync error:', aoSyncErr.message);
        }

        // --- PASS 3: Process Partner Webhook Outbox Queue ---
        try {
            await processWebhookQueue();
        } catch (webhookErr) {
            console.error('❌ [SYNC JOB] Webhook queue processing error:', webhookErr.message);
        }

        // --- PASS 4: Sync Pending MTN Beneficiary Approvals ---
        try {
            const { syncBeneficiaryApprovals } = require('../services/mtnApproval.service');
            const syncResult = await syncBeneficiaryApprovals();
            if (syncResult && (syncResult.syncedCount > 0 || syncResult.approvedCount > 0)) {
                console.log(`📱 [SYNC JOB] MTN Beneficiary sync: checked ${syncResult.syncedCount || 0}, approved & updated ${syncResult.approvedCount || 0}`);
            }
        } catch (mtnSyncErr) {
            console.error('❌ [SYNC JOB] MTN Beneficiary sync error:', mtnSyncErr.message);
        }

    } catch (error) {
        console.error('❌ Status sync job error:', error);
    } finally {
        isRunning = false;
    }
};

/**
 * Start the background sync job
 * Runs every 20 seconds to check for status updates
 */
const startStatusSyncJob = (io) => {
    const SYNC_INTERVAL = 20 * 1000; // 20 seconds (more responsive)

    console.log('🚀 Starting status sync background job (runs every 20 seconds)');

    // Run immediately on startup
    setTimeout(() => syncPendingTransactions(io), 5000); // Wait 5s after startup

    // Then run periodically
    setInterval(() => syncPendingTransactions(io), SYNC_INTERVAL);
};

module.exports = { startStatusSyncJob, syncPendingTransactions };
