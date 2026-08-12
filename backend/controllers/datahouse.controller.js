const pool = require('../config/database');
const crypto = require('crypto');
const { logActivity } = require('../utils/activityLogger');
const { triggerTransactionWebhook } = require('../services/partnerWebhook.service');

/**
 * Handle GetMorePayLess Datahouse webhook callbacks
 * Receives real-time fulfillment updates from Datahouse
 * Signature verification: HMAC-SHA256 via x-telecom-signature header (t=<ts>,v1=<hex>)
 */
const datahouseWebhook = async (req, res) => {
    try {
        // --- Signature Verification (HMAC-SHA256, Stripe/Datahouse style) ---
        const webhookSecret = process.env.DATAHOUSE_WEBHOOK_SECRET;
        const signatureHeader = req.headers['x-telecom-signature'] || req.headers['X-Telecom-Signature'];

        if (webhookSecret) {
            if (!signatureHeader) {
                console.error('❌ Datahouse Webhook: Missing x-telecom-signature header');
                return res.status(401).json({ error: 'Missing webhook signature' });
            }

            try {
                const parts = signatureHeader.split(',');
                let ts = null;
                let sig = null;
                for (const part of parts) {
                    const [k, v] = part.trim().split('=');
                    if (k === 't') ts = v;
                    if (k === 'v1') sig = v;
                }

                if (!ts || !sig) {
                    sig = signatureHeader.startsWith('sha256=') ? signatureHeader.slice(7) : signatureHeader;
                }

                if (ts && Math.abs(Date.now() / 1000 - Number(ts)) > 300) {
                    console.error('❌ Datahouse Webhook: Signature timestamp expired');
                    return res.status(401).json({ error: 'Webhook timestamp expired' });
                }

                const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
                const payloadToSign = ts ? `${ts}.${rawBody}` : rawBody;
                const expectedSig = crypto.createHmac('sha256', webhookSecret).update(payloadToSign).digest('hex');

                const isValid = crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'));
                if (!isValid) {
                    console.error('❌ Datahouse Webhook: Signature mismatch');
                    return res.status(401).json({ error: 'Invalid webhook signature' });
                }
                console.log('✅ Datahouse Webhook signature verified successfully');
            } catch (sigErr) {
                console.error('❌ Datahouse Webhook: Signature comparison error:', sigErr.message);
                return res.status(401).json({ error: 'Invalid webhook signature format' });
            }
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
        const payloadData = eventData.data || {};

        // Skip non-order events (e.g. wallet deposits)
        if (eventType === 'wallet.updated') {
            console.log('💰 Datahouse wallet updated event received, ignoring for transaction processing.');
            return res.json({ success: true, message: 'Wallet update acknowledged' });
        }

        // Identify order identifiers
        const orderId = payloadData.order_id || payloadData.id;
        const reference = payloadData.reference || payloadData.reference_code || payloadData.referenceCode;

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

        // Map event type to final status
        let finalStatus = 'processing';
        if (['order.approved', 'purchase.success', 'order.partially_approved'].includes(eventType)) {
            finalStatus = 'completed';
        } else if (eventType === 'order.rejected') {
            finalStatus = 'rejected';
        } else if (['purchase.failed'].includes(eventType)) {
            finalStatus = 'failed';
        } else if (['order.received', 'order.processing'].includes(eventType)) {
            finalStatus = 'processing';
        }

        console.log(`📋 Updating status for orderId: ${orderId}, reference: ${reference} to: ${finalStatus}`);

        // --- Cross-Table Lookup: Search transactions AND agent_orders ---
        let transaction = null;
        let orderSource = 'transactions';

        // 1. Search main transactions table
        const [txRows] = await pool.execute(
            `SELECT id, user_id, status, api_response, amount_ghc FROM transactions 
             WHERE id::text = ? OR paystack_reference = ?
             OR api_response->'data'->>'id' = ? 
             OR api_response->'data'->>'publicId' = ?
             OR api_response->'data'->>'referenceCode' = ? 
             OR api_response->>'orderId' = ? 
             OR api_response->>'providerPublicId' = ?
             OR api_response->>'providerReferenceCode' = ?`,
            [orderId || '', reference || '', orderId || '', orderId || '', reference || '', orderId || '', orderId || '', reference || '']
        );

        if (txRows.length > 0) {
            transaction = txRows[0];
            orderSource = 'transactions';
        } else {
            // 2. Search agent_orders table (Storefront purchases)
            const [agentOrderRows] = await pool.execute(
                `SELECT id, store_id, agent_id, customer_phone, base_price_ghc, selling_price_ghc, profit_ghc, paystack_reference, fulfillment_status as status, api_response 
                 FROM agent_orders 
                 WHERE id::text = ? OR paystack_reference = ?
                 OR api_response->'data'->>'id' = ?
                 OR api_response->'data'->>'publicId' = ?
                 OR api_response->'data'->>'referenceCode' = ?
                 OR api_response->>'orderId' = ?
                 OR api_response->>'providerPublicId' = ?
                 OR api_response->>'providerReferenceCode' = ?`,
                [orderId || '', reference || '', orderId || '', orderId || '', reference || '', orderId || '', orderId || '', reference || '']
            );
            if (agentOrderRows.length > 0) {
                transaction = agentOrderRows[0];
                orderSource = 'agent_orders';
            }
        }

        if (!transaction) {
            console.error(`❌ No order found in transactions or agent_orders for Datahouse identifiers: order_id=${orderId}, reference=${reference}`);
            return res.status(404).json({ error: 'Order not found' });
        }

        const targetId = transaction.id;

        // Replay/Idempotency check: Skip if already in final state
        const currentStatus = transaction.status;
        if (currentStatus === 'completed' || currentStatus === 'fulfilled' || currentStatus === 'failed' || currentStatus === 'refunded') {
            console.warn(`🛡️ Webhook: Order ${targetId} is already in final state "${currentStatus}". Ignoring duplicate event.`);
            return res.status(200).json({ success: true, message: 'Order already in final state', status: currentStatus });
        }

        // Merge api_response metadata
        let existingApiResponse = {};
        try {
            if (transaction.api_response) {
                existingApiResponse = typeof transaction.api_response === 'string'
                    ? JSON.parse(transaction.api_response)
                    : transaction.api_response;
            }
        } catch (e) {}

        const updatedApiResponse = {
            ...existingApiResponse,
            datahouse_webhook: eventData,
            last_webhook_status: eventType,
            updated_at: new Date().toISOString()
        };

        // --- Execute Updates based on Order Source ---
        let isRefunded = false;

        if (orderSource === 'transactions') {
            const dbStatus = (finalStatus === 'rejected' || finalStatus === 'failed') ? 'failed' : finalStatus;

            await pool.execute(
                'UPDATE transactions SET status = ?, api_response = ? WHERE id = ?::uuid',
                [dbStatus, JSON.stringify(updatedApiResponse), targetId]
            );

            if (finalStatus === 'failed' || finalStatus === 'rejected') {
                const { processAutomatedRefund } = require('../utils/refundHelper');
                const refundRes = await processAutomatedRefund({
                    transactionId: targetId,
                    userId: transaction.user_id,
                    reason: `Datahouse webhook event (${eventType})`
                });
                isRefunded = refundRes.success;
            }

            triggerTransactionWebhook(targetId, finalStatus).catch(() => {});

            // Socket.IO notification for main customer
            const io = req.app.get('io');
            if (io && transaction.user_id) {
                io.to(transaction.user_id).emit('transactionUpdate', {
                    transactionId: targetId,
                    status: finalStatus,
                    message: finalStatus === 'completed'
                        ? 'Your data bundle has been delivered!'
                        : (finalStatus === 'failed' || finalStatus === 'rejected')
                            ? (isRefunded ? 'Data bundle delivery failed. Your wallet has been automatically refunded.' : 'Data bundle delivery failed. Please contact support.')
                            : 'Your order status has been updated.'
                });
            }

        } else if (orderSource === 'agent_orders') {
            const dbFulfillmentStatus = finalStatus === 'completed' ? 'completed' : ((finalStatus === 'failed' || finalStatus === 'rejected') ? 'refunded' : 'processing');
            
            await pool.execute(
                `UPDATE agent_orders 
                 SET fulfillment_status = ?, api_response = ?, updated_at = NOW() 
                 WHERE id = ?::uuid`,
                [dbFulfillmentStatus, JSON.stringify(updatedApiResponse), targetId]
            );

            // If storefront order succeeded, credit agent profit if not already completed
            if (dbFulfillmentStatus === 'completed' && transaction.status !== 'completed') {
                const profitGhc = parseFloat(transaction.profit_ghc || 0);
                if (profitGhc > 0 && transaction.agent_id) {
                    await pool.execute(
                        `UPDATE agent_wallets 
                         SET available_balance = available_balance + ?,
                             total_profit_earned = total_profit_earned + ?,
                             updated_at = NOW()
                         WHERE agent_id = ?::uuid`,
                        [profitGhc, profitGhc, transaction.agent_id]
                    ).catch(err => console.error('Error crediting agent profit on webhook:', err));
                }
            }

            // Socket.IO notification for storefront agent & customer
            const io = req.app.get('io');
            if (io && transaction.agent_id) {
                io.to(transaction.agent_id).emit('agentOrderUpdate', {
                    orderId: targetId,
                    status: dbFulfillmentStatus,
                    message: dbFulfillmentStatus === 'completed' ? 'Storefront order completed & delivered!' : 'Storefront order updated'
                });
            }
        }

        console.log(`✅ Order ${targetId} (${orderSource}) updated to ${finalStatus} via Webhook`);
        res.json({ success: true, message: 'Webhook processed', status: finalStatus, source: orderSource });

    } catch (error) {
        console.error('❌ Datahouse webhook error:', error);
        res.status(500).json({ error: 'Internal server error processing webhook' });
    }
};

module.exports = { datahouseWebhook };
