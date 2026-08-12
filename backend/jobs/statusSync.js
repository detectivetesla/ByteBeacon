const pool = require('../config/database');
const { checkOrderStatus, extractProviderId } = require('../utils/sourcing');
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
        // These orders were placed through the old provider and cannot be synced with Datahouse
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
                // Notify affected users
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
        // Only sync orders placed AFTER the Datahouse migration date
        const [transactions] = await pool.execute(`
            SELECT t.id, t.user_id, t.status, t.api_response, t.created_at, t.recipient_phone
            FROM transactions t
            WHERE t.status IN ('processing', 'ongoing', 'queued', 'pending')
            AND t.created_at >= ?
            AND t.created_at < NOW() - INTERVAL '5 seconds'
            ORDER BY t.created_at ASC
            LIMIT 50
        `, [DATAHOUSE_MIGRATION_DATE]);

        if (transactions.length === 0) {
            console.log('✅ No processing transactions to sync');
            isRunning = false;
            return;
        }

        console.log(`📋 Found ${transactions.length} transactions to check`);

        for (const transaction of transactions) {
            try {
                // Detect which provider was used from api_response metadata
                let providerName = null;
                try {
                    let apiData = transaction.api_response;
                    if (typeof apiData === 'string') apiData = JSON.parse(apiData);
                    providerName = apiData?.provider || null;
                } catch (e) {}

                // Parse api_response to get provider's orderId or reference
                let providerIdentifier = extractProviderId(transaction.api_response, transaction.id, transaction.recipient_phone, providerName);

                console.log(`🔍 Checking status for ${transaction.id} (provider: ${providerName || 'auto'}, identifier: ${providerIdentifier})`);

                // Check status with the correct provider
                const result = await checkOrderStatus(providerIdentifier, providerName);

                if (!result.success) {
                    console.warn(`⚠️ Failed to get status for ${transaction.id}: ${result.error}`);
                    continue;
                }

                const newStatus = result.status;

                // If status changed, update database
                if (newStatus !== transaction.status) {
                    console.log(`✅ [SYNC SUCCESS] Status changed for ${transaction.id}: ${transaction.status} -> ${newStatus} (Portal: ${result.portalStatus})`);

                    // Merge existing api_response with new data to preserve metadata (like orderId)
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
                        portalStatus: result.portalStatus
                    };

                    await pool.execute(
                        'UPDATE transactions SET status = ?, api_response = ? WHERE id = ?::uuid',
                        [newStatus, JSON.stringify(mergedResponse), transaction.id]
                    );

                    let isRefunded = false;
                    if (newStatus === 'failed') {
                        const { processAutomatedRefund } = require('../utils/refundHelper');
                        const refundRes = await processAutomatedRefund({
                            transactionId: transaction.id,
                            userId: transaction.user_id,
                            reason: 'Background status sync detected delivery failure'
                        });
                        isRefunded = refundRes.success;
                    }

                    // Emit socket event to notify user
                    if (io) {
                        io.to(transaction.user_id).emit('transactionUpdate', {
                            transactionId: transaction.id,
                            status: newStatus,
                            message: newStatus === 'completed'
                                ? 'Your data bundle has been delivered!'
                                : newStatus === 'failed'
                                    ? (isRefunded ? 'Data bundle delivery failed. Your wallet has been automatically refunded.' : 'Data bundle delivery failed. Please contact support.')
                                    : 'Your order status has been updated.'
                        });
                    }

                    // Trigger partner webhook if applicable
                    triggerTransactionWebhook(transaction.id, newStatus).catch(() => {});
                }
            } catch (err) {
                console.error(`❌ Error syncing transaction ${transaction.id}:`, err.message);
            }

            // Small delay between API calls to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        console.log('✅ Background status sync completed for main transactions');

        // --- PASS 2.5: Sync Status for Ongoing Agent Storefront Orders ---
        try {
            const [agentOrders] = await pool.execute(`
                SELECT id, agent_id, customer_phone, fulfillment_status, api_response, created_at
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

                        if (result.success && result.status !== 'processing') {
                            const newStatus = result.status === 'completed' ? 'completed' : 'refunded';
                            console.log(`✅ [STOREFRONT SYNC] Status changed for order ${ao.id}: -> ${newStatus}`);

                            await pool.execute(
                                `UPDATE agent_orders SET fulfillment_status = ?, updated_at = NOW() WHERE id = ?::uuid`,
                                [newStatus, ao.id]
                            );

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
