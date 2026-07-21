const pool = require('../config/database');
const crypto = require('crypto');
const { logActivity } = require('../utils/activityLogger');
const { triggerTransactionWebhook } = require('../services/partnerWebhook.service');

/**
 * Handle GetMorePayLess Datahouse webhook callbacks
 * This endpoint receives status updates from Datahouse about order fulfillment
 * Signature verification: HMAC-SHA256 via x-telecom-signature header
 */
const datahouseWebhook = async (req, res) => {
    try {
        // --- Signature Verification (HMAC-SHA256, Stripe-style) ---
        const webhookSecret = process.env.DATAHOUSE_WEBHOOK_SECRET;
        const signature = req.headers['x-telecom-signature'];

        if (webhookSecret) {
            if (!signature) {
                console.error('❌ Datahouse Webhook: Missing x-telecom-signature header');
                return res.status(401).json({ error: 'Missing webhook signature' });
            }

            // Use rawBody (set by express.json verify option in server.js)
            const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
            const computedSig = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

            // Compare signatures (timing-safe)
            const sigToCompare = signature.startsWith('sha256=') ? signature.slice(7) : signature;
            try {
                const isValid = crypto.timingSafeEqual(
                    Buffer.from(computedSig, 'hex'),
                    Buffer.from(sigToCompare, 'hex')
                );
                if (!isValid) {
                    console.error('❌ Datahouse Webhook: Signature mismatch');
                    return res.status(401).json({ error: 'Invalid webhook signature' });
                }
            } catch (sigErr) {
                console.error('❌ Datahouse Webhook: Signature comparison error:', sigErr.message);
                return res.status(401).json({ error: 'Invalid webhook signature format' });
            }

            console.log('✅ Datahouse Webhook signature verified');
        } else {
            console.warn('⚠️ DATAHOUSE_WEBHOOK_SECRET not set — skipping signature verification');
        }

        const eventData = req.body;
        
        console.log('📞 Datahouse Webhook raw body:', JSON.stringify(eventData, null, 2));

        if (!eventData || !eventData.type) {
            console.error('❌ Datahouse Webhook missing event type');
            return res.status(400).json({ error: 'Missing event type' });
        }

        const eventType = eventData.type;
        const payloadData = eventData.data;

        // Skip wallet updates for transaction status updates
        if (eventType === 'wallet.updated') {
            console.log('💰 Datahouse wallet updated event received, ignoring for transaction processing.');
            return res.json({ success: true, message: 'Wallet update acknowledged' });
        }

        // Identify transaction identifiers
        const orderId = payloadData?.order_id || payloadData?.id;
        const reference = payloadData?.reference || payloadData?.referenceCode;

        console.log('📞 Datahouse Webhook parsed details:', {
            eventType,
            orderId,
            reference,
            timestamp: new Date().toISOString()
        });

        if (!orderId && !reference) {
            console.error('❌ Webhook missing transaction identifiers (order_id and reference)');
            return res.status(400).json({ error: 'Missing transaction identifiers' });
        }

        // Map event type to our final status
        let finalStatus = 'processing';
        if (['order.approved', 'purchase.success'].includes(eventType)) {
            finalStatus = 'completed';
        } else if (['order.rejected', 'purchase.failed'].includes(eventType)) {
            finalStatus = 'failed';
        } else if (['order.partially_approved'].includes(eventType)) {
            finalStatus = 'completed'; // Partially approved is treated as completed (remaining got refunded)
        } else if (['order.received'].includes(eventType)) {
            finalStatus = 'processing';
        }

        console.log(`📋 Updating transaction status for orderId: ${orderId}, reference: ${reference} to: ${finalStatus}`);

        let transaction = null;

        // 1. Search by reference (UUID format check)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference);
        if (isUuid) {
            const [txById] = await pool.execute('SELECT id, user_id, status, api_response, amount_ghc FROM transactions WHERE id = ?::uuid', [reference]);
            if (txById.length > 0) transaction = txById[0];
        }

        // 2. Search database by matches in JSON api_response
        if (!transaction) {
            const [txByRef] = await pool.execute(
                `SELECT id, user_id, status, api_response, amount_ghc FROM transactions 
                 WHERE api_response->'data'->>'id' = ? 
                 OR api_response->'data'->>'referenceCode' = ? 
                 OR api_response->>'orderId' = ? 
                 OR api_response->>'orderReference' = ?
                 OR api_response->'order'->>'id' = ?
                 OR api_response->'order'->>'referenceCode' = ?
                 OR id::text = ?
                 OR api_response->>'id' = ?`,
                [orderId, reference, orderId, reference, orderId, reference, reference, orderId]
            );
            if (txByRef.length > 0) transaction = txByRef[0];
        }

        if (!transaction) {
            console.error(`❌ No transaction found for Datahouse identifiers: order_id=${orderId}, reference=${reference}`);
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const transactionId = transaction.id;

        // SECURITY: Prevent status changes once a transaction is in a final state
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
            datahouse_webhook: eventData,
            last_webhook_status: eventType,
            updated_at: new Date().toISOString()
        };

        // Update transaction
        await pool.execute(
            'UPDATE transactions SET status = ?, api_response = ? WHERE id = ?::uuid',
            [finalStatus, JSON.stringify(updatedApiResponse), transactionId]
        );

        let isRefunded = false;
        if (finalStatus === 'failed') {
            const { processAutomatedRefund } = require('../utils/refundHelper');
            const refundRes = await processAutomatedRefund({
                transactionId: transactionId,
                userId: transaction.user_id,
                reason: `Datahouse webhook failure event (${eventType})`
            });
            isRefunded = refundRes.success;
        }

        console.log(`✅ Transaction ${transactionId} updated to ${finalStatus} via Webhook`);

        // Trigger partner webhook if applicable
        triggerTransactionWebhook(transactionId, finalStatus).catch(() => {});

        // Emit socket/real-time event
        const io = req.app.get('io');
        if (io) {
            io.to(transaction.user_id).emit('transactionUpdate', {
                transactionId: transactionId,
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
        console.error('❌ Datahouse webhook error:', error);
        res.status(500).json({ error: 'Internal server error processing webhook' });
    }
};

module.exports = { datahouseWebhook };
