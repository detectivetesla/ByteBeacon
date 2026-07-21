const pool = require('../config/database');
const { logActivity } = require('../utils/activityLogger');
const { triggerTransactionWebhook } = require('../services/partnerWebhook.service');

/**
 * Handle Portal-02 webhook callbacks
 * This endpoint receives status updates from Portal-02 about order fulfillment
 */
const portal02Webhook = async (req, res) => {
    try {
        const webhookData = req.body;
        // Identify transaction: Try query param first, then body reference/id/orderId
        let transactionId = req.query.transactionId || webhookData?.reference || webhookData?.orderId || webhookData?.order_id || webhookData?._id || webhookData?.id;

        console.log('📞 Portal-02 Webhook received:', {
            transactionId,
            status: webhookData?.status,
            reference: webhookData?.reference,
            timestamp: new Date().toISOString()
        });

        if (!transactionId) {
            console.error('❌ Webhook missing transaction identifier');
            return res.status(400).json({ error: 'Missing transaction identifier' });
        }

        // Map Portal-02 status to our finalStatus
        const portalStatus = String(
            webhookData?.status ||
            webhookData?.items?.[0]?.status ||
            ''
        ).toLowerCase();

        let finalStatus = 'processing';
        if (['completed', 'success', 'delivered', 'fulfilled', 'resolved', 'delivered_callback'].includes(portalStatus)) {
            finalStatus = 'completed';
        } else if (['failed', 'error', 'cancelled', 'rejected', 'failed_callback', 'refunded'].includes(portalStatus)) {
            finalStatus = 'failed';
        } else if (['pending', 'processing', 'ongoing', 'queued'].includes(portalStatus)) {
            finalStatus = 'processing';
        }

        console.log(`📋 Updating transaction ${transactionId} status to: ${finalStatus}`);

        // Try searching by ID (UUID check)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transactionId);
        let transaction = null;

        if (isUuid) {
            const [txById] = await pool.execute('SELECT id, user_id, status, api_response, amount_ghc FROM transactions WHERE id = ?::uuid', [transactionId]);
            if (txById.length > 0) transaction = txById[0];
        }

        if (!transaction) {
            // Search by various identifiers in api_response
            const [txByRef] = await pool.execute(
                `SELECT id, user_id, status, api_response, amount_ghc FROM transactions 
                 WHERE api_response->>'reference' = ? 
                 OR api_response->>'orderId' = ? 
                 OR api_response->>'order_id' = ? 
                 OR api_response->>'_id' = ? 
                 OR api_response->>'id' = ?
                 OR api_response->>'requestId' = ?
                 OR api_response->'portal02'->>'orderId' = ?`,
                [transactionId, transactionId, transactionId, transactionId, transactionId, transactionId, transactionId]
            );
            if (txByRef.length > 0) transaction = txByRef[0];
        }

        if (!transaction) {
            console.error(`❌ No transaction found for identifier: ${transactionId}`);
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // SECURITY: Prevent status changes once a transaction is in a final state
        // This prevents hackers from trying to "un-fail" or "re-process" an order via webhook spoofing
        if (transaction.status === 'completed' || transaction.status === 'failed') {
            console.warn(`🛡️ Webhook: Transaction ${transactionId} is already in final state ${transaction.status}. Ignoring update.`);
            return res.status(200).json({ success: true, message: 'Transaction already in final state', status: transaction.status });
        }

        // Merge existing api_response with new webhook data
        let existingApiResponse = {};
        try {
            if (transaction.api_response) {
                existingApiResponse = typeof transaction.api_response === 'string'
                    ? JSON.parse(transaction.api_response)
                    : transaction.api_response;
            }
        } catch (e) {
            console.error('Error parsing existing api_response:', e);
        }

        const updatedApiResponse = {
            ...existingApiResponse,
            portal02_webhook: webhookData,
            last_webhook_status: portalStatus,
            updated_at: new Date().toISOString()
        };

        // Update transaction
        await pool.execute(
            'UPDATE transactions SET status = ?, api_response = ? WHERE id = ?::uuid',
            [finalStatus, JSON.stringify(updatedApiResponse), transaction.id]
        );

        let isRefunded = false;
        if (finalStatus === 'failed') {
            const { processAutomatedRefund } = require('../utils/refundHelper');
            const refundRes = await processAutomatedRefund({
                transactionId: transaction.id,
                userId: transaction.user_id,
                reason: `Portal-02 webhook failure event (${portalStatus})`
            });
            isRefunded = refundRes.success;
        }

        // Trigger partner webhook if applicable
        triggerTransactionWebhook(transaction.id, finalStatus).catch(() => {});

        // Emit socket/real-time event
        const io = req.app.get('io');
        if (io) {
            io.to(transaction.user_id).emit('transactionUpdate', {
                transactionId: transaction.id,
                status: finalStatus,
                message: finalStatus === 'completed'
                    ? 'Your data bundle has been delivered!'
                    : finalStatus === 'failed'
                        ? (isRefunded ? 'Data bundle delivery failed. Your wallet has been automatically refunded.' : 'Data bundle delivery failed. Please contact support.')
                        : 'Your order status has been updated.'
            });
        }

        res.json({ success: true, message: 'Webhook processed', status: finalStatus });

    } catch (error) {
        console.error('❌ Portal-02 webhook error:', error);
        res.status(500).json({ error: 'Internal server error processing webhook' });
    }
};

module.exports = { portal02Webhook };
