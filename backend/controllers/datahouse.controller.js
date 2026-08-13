const pool = require('../config/database');
const {
    verifyWebhookSignature,
    extractDeliveryId,
    isDuplicateDelivery,
    recordWebhookEvent
} = require('../integrations/datahouse/webhooks');
const { processAutomatedRefund } = require('../utils/refundHelper');
const { logActivity } = require('../utils/activityLogger');
const { triggerTransactionWebhook } = require('../services/partnerWebhook.service');

/**
 * Authoritative DataHouse Webhook Callback Controller
 *
 * Receives real-time fulfillment updates from DataHouse.
 * - Verifies HMAC-SHA256 signature (X-Telecom-Signature: t=<timestamp>,v1=<sig>)
 * - Checks delivery idempotency (X-Telecom-Delivery-Id)
 * - Synchronizes authoritative DataHouse order state
 * - Triggers wallet refund on rejection/failure
 * - Pushes real-time WebSocket updates to the customer room
 */
const datahouseWebhook = async (req, res) => {
    try {
        const signatureHeader = req.headers['x-telecom-signature'] || req.headers['X-Telecom-Signature'];
        const rawBody = req.rawBody || req.body;

        // 1. Verify HMAC-SHA256 Signature
        const verification = verifyWebhookSignature({
            signatureHeader,
            rawBody
        });

        if (!verification.valid) {
            console.error('❌ [DataHouse Webhook] Signature verification failed:', verification.reason);
            return res.status(401).json({ error: 'Invalid webhook signature', reason: verification.reason });
        }

        const eventData = req.body;
        if (!eventData || !eventData.type) {
            return res.status(400).json({ error: 'Missing event payload or event type' });
        }

        const eventType = eventData.type;
        const payloadData = eventData.data || {};
        const deliveryId = extractDeliveryId(req.headers, eventData);

        console.log(`📞 [DataHouse Webhook] Received ${eventType} (Delivery ID: ${deliveryId})`);

        // 2. Prevent Duplicate Delivery Processing (Idempotency)
        const isDuplicate = await isDuplicateDelivery(deliveryId);
        if (isDuplicate) {
            console.log(`🛡️ [DataHouse Webhook] Duplicate delivery ${deliveryId} already processed. Acknowledging.`);
            return res.status(200).json({ success: true, message: 'Duplicate delivery acknowledged', deliveryId });
        }

        // Handle wallet updates separately
        if (eventType === 'wallet.updated') {
            await recordWebhookEvent({
                deliveryId,
                eventType,
                payload: eventData
            });
            return res.status(200).json({ success: true, message: 'Wallet update acknowledged' });
        }

        // Identify order references
        const orderId = payloadData.order_id || payloadData.id || payloadData.publicId;
        const reference = payloadData.reference || payloadData.reference_code || payloadData.referenceCode;

        if (!orderId && !reference) {
            console.warn('⚠️ [DataHouse Webhook] Missing order identifiers in webhook payload');
            return res.status(400).json({ error: 'Missing order identifiers' });
        }

        // Map event type to authoritative order status
        let finalStatus = 'processing';
        let isSuccessState = false;
        let isFailureState = false;

        if (['order.approved', 'purchase.success', 'fulfilled'].includes(eventType)) {
            finalStatus = 'approved';
            isSuccessState = true;
        } else if (['order.partially_approved'].includes(eventType)) {
            finalStatus = 'partially_approved';
            isSuccessState = true;
        } else if (['order.rejected', 'rejected'].includes(eventType)) {
            finalStatus = 'rejected';
            isFailureState = true;
        } else if (['purchase.failed', 'fulfillment_failed'].includes(eventType)) {
            finalStatus = 'failed';
            isFailureState = true;
        } else if (['order.received', 'received'].includes(eventType)) {
            finalStatus = 'received';
        } else if (['order.processing', 'processing'].includes(eventType)) {
            finalStatus = 'processing';
        }

        // 3. Find Matching Order Record in ByteBeacon
        const [txRows] = await pool.execute(
            `SELECT id, user_id, status, amount_ghc, datahouse_order_id, reference_code 
             FROM transactions 
             WHERE id::text = ? OR datahouse_order_id = ? OR reference_code = ?
                OR api_response->>'id' = ? OR api_response->>'publicId' = ? OR api_response->>'referenceCode' = ?`,
            [orderId || '', orderId || '', reference || '', orderId || '', orderId || '', reference || '']
        );

        if (txRows.length > 0) {
            const tx = txRows[0];
            const previousStatus = tx.status;

            // Update synchronized order record
            await pool.execute(
                `UPDATE transactions 
                 SET status = ?,
                     current_datahouse_status = ?,
                     mapped_bytebeacon_status = ?,
                     datahouse_order_id = COALESCE(?, datahouse_order_id),
                     reference_code = COALESCE(?, reference_code),
                     last_synced_at = CURRENT_TIMESTAMP,
                     sync_status = 'synced',
                     api_response = ?::jsonb,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?::uuid`,
                [
                    finalStatus,
                    finalStatus,
                    finalStatus,
                    orderId || null,
                    reference || null,
                    JSON.stringify(eventData),
                    tx.id
                ]
            );

            console.log(`✅ [DataHouse Webhook] Updated transaction ${tx.id} status from ${previousStatus} -> ${finalStatus}`);

            // 4. Automated Refund on Failure / Rejection if not previously refunded
            if (isFailureState && previousStatus !== 'failed' && previousStatus !== 'rejected') {
                try {
                    await processAutomatedRefund({
                        transactionId: tx.id,
                        userId: tx.user_id,
                        amountGhc: tx.amount_ghc,
                        reason: `DataHouse carrier order ${finalStatus}: ${eventType}`
                    });
                } catch (refundErr) {
                    console.error('❌ Automated refund error:', refundErr.message);
                }
            }

            // 5. Emit Real-time WebSocket Event to Customer
            const io = req.app.get('io') || global.io;
            if (io && tx.user_id) {
                io.to(tx.user_id).emit('transactionUpdate', {
                    transactionId: tx.id,
                    orderId,
                    referenceCode: reference,
                    status: finalStatus,
                    message: isSuccessState
                        ? 'Your data bundle has been approved and delivered!'
                        : isFailureState
                            ? 'Data delivery failed or was rejected. Wallet has been automatically refunded.'
                            : 'Your order is currently processing.'
                });
            }

            // Trigger partner webhook if applicable
            triggerTransactionWebhook(tx.id, finalStatus).catch(() => {});
        }

        // 6. Record delivery as processed in audit log
        await recordWebhookEvent({
            deliveryId,
            eventType,
            orderId,
            referenceCode: reference,
            payload: eventData
        });

        res.status(200).json({
            success: true,
            message: 'Webhook processed successfully',
            deliveryId,
            status: finalStatus
        });

    } catch (error) {
        console.error('❌ [DataHouse Webhook] Handler error:', error);
        res.status(500).json({ error: 'Internal server error processing webhook: ' + error.message });
    }
};

module.exports = {
    datahouseWebhook
};
