const pool = require('../config/database');
const { placeDataOrder, checkOrderStatus, extractProviderId } = require('../utils/sourcing');
const { logActivity } = require('../utils/activityLogger');
const { triggerTransactionWebhook } = require('./partnerWebhook.service');

/**
 * Service to manage the order processing queue
 * This replaces the unreliable detached IIFE and handles retries
 */

const MAX_RETRIES = 8;
const RETRY_INTERVALS = [0.5, 1, 2, 5, 10, 20, 30, 60]; // minutes (Faster retries)

// Orders placed before this date were fulfilled via Portal-02 (now decommissioned).
const DATAHOUSE_MIGRATION_DATE = '2026-07-01T00:00:00Z';

/**
 * Process pending orders in the queue
 */
const processOrderQueue = async (io) => {
    console.log('🔄 [QUEUE] Checking for pending orders to process...');

    try {
        // Fetch orders that are in 'processing' state and due for (re)try
        // We only pick up orders that haven't reached max retries
        const [orders] = await pool.execute(`
            SELECT t.*, d.network, d.data_amount 
            FROM transactions t
            LEFT JOIN data_bundles d ON t.bundle_id = d.id::uuid
            WHERE t.status IN ('processing', 'pending')
            AND t.created_at >= ?
            AND t.retry_count < ?
            AND t.next_retry_at <= CURRENT_TIMESTAMP
            AND (t.api_response IS NULL OR t.api_response->>'success' IS NULL OR t.api_response->>'success' = 'false')
            ORDER BY t.created_at ASC
            LIMIT 10
        `, [DATAHOUSE_MIGRATION_DATE, MAX_RETRIES]);

        if (orders.length === 0) {
            return { processed: 0, message: 'No orders due for processing' };
        }

        console.log(`📋 [QUEUE] Found ${orders.length} orders to process`);

        for (const order of orders) {
            await processSingleOrder(order, io);
        }

        return { processed: orders.length };
    } catch (error) {
        console.error('❌ [QUEUE] Error fetching orders from queue:', error);
        return { error: error.message };
    }
};

/**
 * Process a single order from the queue
 */
const processSingleOrder = async (order, io) => {
    const transactionId = order.id;
    console.log(`🚀 [QUEUE] Processing order ${transactionId} (Retry: ${order.retry_count})`);

    try {
        // 1. Double check if status is still 'processing'
        // (Just in case a webhook updated it between the fetch and now)
        const [current] = await pool.execute('SELECT status FROM transactions WHERE id = ?::uuid', [transactionId]);
        if (current.length === 0 || (current[0].status !== 'processing' && current[0].status !== 'pending')) {
            console.log(`⏭️ [QUEUE] Order ${transactionId} already ${current[0]?.status || 'gone'}, skipping.`);
            return;
        }

        // 2. Call Datahouse API
        const fulfillment = await placeDataOrder({
            network: order.network,
            dataAmount: order.data_amount,
            recipientPhone: order.recipient_phone,
            transactionId: transactionId
        });

        const newStatus = fulfillment.status;
        const apiResponse = fulfillment.apiResponse || { error: fulfillment.message || fulfillment.error };

        if (newStatus === 'completed' || newStatus === 'ongoing' || newStatus === 'processing') {
            // SUCCESS or STARTED
            console.log(`✅ [QUEUE] Order ${transactionId} fulfilled successfully: ${newStatus}`);

            await pool.execute(
                'UPDATE transactions SET status = ?, api_response = ?, failure_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                [newStatus, JSON.stringify(apiResponse), transactionId]
            );

            // Trigger partner webhook if applicable
            triggerTransactionWebhook(transactionId, newStatus).catch(() => {});

            // Notify user
            if (io) {
                io.to(order.user_id).emit('transactionUpdate', {
                    transactionId,
                    status: newStatus,
                    message: newStatus === 'completed' ? 'Your data bundle has been delivered!' : 'Your order is being processed by the provider.'
                });
            }
        } else {
            // FAILURE - Handle retry logic
            const retryCount = order.retry_count + 1;
            const errorMsg = fulfillment.message || fulfillment.error || 'Unknown error';

            if (retryCount >= MAX_RETRIES) {
                // TERMINAL FAILURE - Trigger Refund
                console.log(`🛑 [QUEUE] Max retries reached for ${transactionId}. Refunding...`);
                await handleOrderFailure(order, errorMsg, io);
            } else {
                // SCHEDULE RETRY
                const waitMinutes = RETRY_INTERVALS[retryCount] || 240;
                const nextRetry = new Date();
                nextRetry.setMinutes(nextRetry.getMinutes() + waitMinutes);

                console.warn(`⚠️ [QUEUE] Order ${transactionId} failed. Retry ${retryCount}/${MAX_RETRIES} scheduled for ${nextRetry.toISOString()}`);

                await pool.execute(
                    'UPDATE transactions SET retry_count = ?, next_retry_at = ?, failure_reason = ?, api_response = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                    [retryCount, nextRetry, errorMsg, JSON.stringify(apiResponse), transactionId]
                );
            }
        }
    } catch (error) {
        console.error(`❌ [QUEUE] Fatal error processing order ${transactionId}:`, error);

        // Schedule specialized retry for code crashes
        const nextRetry = new Date();
        nextRetry.setMinutes(nextRetry.getMinutes() + 5);

        await pool.execute(
            'UPDATE transactions SET retry_count = retry_count + 1, next_retry_at = ?, failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
            [nextRetry, `SYSTEM_CRASH: ${error.message}`, transactionId]
        );
    }
};

const { processAutomatedRefund } = require('../utils/refundHelper');

/**
 * Final failure handler: Mark as failed & trigger automated refund
 */
const handleOrderFailure = async (order, reason, io) => {
    const transactionId = order.id;
    const userId = order.user_id;

    try {
        // 1. Process automated refund atomically
        const refundResult = await processAutomatedRefund({
            transactionId,
            userId,
            partnerId: order.partner_id || null,
            amountGhc: order.amount_ghc,
            reason: reason || 'Delivery failed after maximum retries'
        });

        // Ensure transaction status is updated to failed
        await pool.execute(
            'UPDATE transactions SET status = ?, failure_reason = COALESCE(failure_reason, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
            ['failed', reason, transactionId]
        );

        // Trigger partner webhook if applicable
        triggerTransactionWebhook(transactionId, 'failed').catch(() => {});

        console.log(`🛑 [QUEUE] Transaction ${transactionId} marked as failed. Reason: ${reason}. Refunded: ${refundResult.success}`);

        // 2. Notify user
        if (io && userId) {
            io.to(userId).emit('transactionUpdate', {
                transactionId,
                status: 'failed',
                message: refundResult.success
                    ? 'Order delivery failed after multiple attempts. Your wallet has been automatically refunded.'
                    : 'Order delivery failed after multiple attempts. Please contact support.'
            });
        }
    } catch (error) {
        console.error(`❌ [QUEUE] Failed to mark transaction ${transactionId} as failed:`, error);
    }
};

module.exports = { processOrderQueue };

