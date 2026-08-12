const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { placeDataOrder, getSourcingConfig } = require('../utils/sourcing');
const { processAutomatedRefund } = require('../utils/refundHelper');

// Paystack API base URL
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Initialize payment with Paystack
exports.processPayment = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const userId = req.user.id;
        const { email, amount, bundleId, recipientPhone, network, dataAmount, callbackUrl } = req.body;

        if (!email || !amount || !bundleId || !recipientPhone) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Validate bundle existence, active state, and assigned provider
        const [bundles] = await connection.execute(
            'SELECT id, is_active, provider_slug FROM data_bundles WHERE id = ?::uuid',
            [bundleId]
        );
        if (bundles.length === 0) {
            return res.status(404).json({ success: false, error: 'Data plan not found' });
        }
        if (!bundles[0].is_active) {
            return res.status(400).json({ success: false, error: 'This data plan is currently disabled and unavailable for purchase' });
        }

        // PRECHECK: Centralized MTN beneficiary validation BEFORE initializing Paystack or creating transaction
        const { validateBeneficiaryBeforeOrder } = require('../services/mtnValidation.service');
        const validation = await validateBeneficiaryBeforeOrder({
            network: network || 'MTN',
            recipientPhone: recipientPhone,
            bundleSize: dataAmount || 'Unknown',
            source: 'STOREFRONT'
        });

        if (!validation.allowed) {
            connection.release();
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
                        network: network || 'MTN',
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

        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!paystackSecretKey) {
            return res.status(500).json({ success: false, error: 'Payment service not configured' });
        }

        // Determine callback URL
        const resolvedCallbackUrl = callbackUrl || `${process.env.FRONTEND_URL}/payment-callback`;

        // Initialize Paystack transaction
        const paystackResponse = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                amount: Math.round(amount * 100), // Paystack expects amount in pesewas
                currency: 'GHS',
                callback_url: resolvedCallbackUrl,
                metadata: {
                    bundle_id: bundleId,
                    recipient_phone: recipientPhone,
                    network,
                    data_amount: dataAmount,
                    user_id: userId,
                },
            }),
        });

        const paystackData = await paystackResponse.json();

        if (!paystackData.status || !paystackData.data) {
            console.error('❌ Paystack initialization failed:', paystackData);
            return res.status(400).json({
                success: false,
                error: paystackData.message || 'Failed to initialize payment',
                details: paystackData
            });
        }

        // Get active sourcing provider fallback
        const sourcingConfig = await getSourcingConfig();
        const activeProviderSlug = sourcingConfig.active_sourcing_api || 'datahouse';
        const assignedProvider = bundles[0].provider_slug || activeProviderSlug;

        // Create processing transaction in database
        const transactionId = uuidv4();
        await connection.execute(
            `INSERT INTO transactions (id, user_id, bundle_id, recipient_phone, amount_ghc, paystack_reference, status, source_provider, created_at)
             VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?, ?, 'pending_payment', ?, NOW())`,
            [transactionId, userId, bundleId, recipientPhone, amount, paystackData.data.reference, assignedProvider]
        );

        res.json({
            success: true,
            authorization_url: paystackData.data.authorization_url,
            reference: paystackData.data.reference,
            transaction_id: transactionId,
        });

    } catch (error) {
        console.error('Payment processing error:', error);
        res.status(500).json({ success: false, error: error.message || 'Payment processing failed' });
    } finally {
        if (connection) connection.release();
    }
};

// Verify payment with Paystack and process data bundle order
exports.verifyPayment = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { reference } = req.body;

        if (!reference) {
            return res.status(400).json({ success: false, error: 'Missing payment reference' });
        }

        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!paystackSecretKey) {
            return res.status(500).json({ success: false, error: 'Payment service not configured' });
        }

        // Verify with Paystack
        const verifyResponse = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
            headers: {
                'Authorization': `Bearer ${paystackSecretKey}`,
            },
        });

        const verifyData = await verifyResponse.json();

        if (!verifyData.status || !verifyData.data) {
            console.error('❌ Paystack verification API error:', verifyData);
            return res.status(400).json({ success: false, error: verifyData.message || 'Payment verification failed' });
        }

        if (verifyData.data.status !== 'success') {
            console.error('❌ Paystack verification unsuccessful:', verifyData.data.status);
            // Update transaction as failed
            await connection.execute(
                `UPDATE transactions SET status = 'failed', api_response = ? WHERE paystack_reference = ?`,
                [JSON.stringify(verifyData), reference]
            );
            return res.status(400).json({
                success: false,
                error: 'Payment verification failed',
                paymentStatus: verifyData.data.status
            });
        }

        // Get transaction and bundle details
        const [transactions] = await connection.execute(
            `SELECT t.*, b.network, b.data_amount, b.provider_slug 
             FROM transactions t 
             LEFT JOIN data_bundles b ON t.bundle_id = b.id::uuid 
             WHERE t.paystack_reference = ?`,
            [reference]
        );

        if (transactions.length === 0) {
            return res.status(404).json({ success: false, error: 'Transaction not found' });
        }

        const transaction = transactions[0];

        // SECURITY: Ensure the transaction belongs to the authenticated user
        if (transaction.user_id !== req.user.id) {
            console.error(`🚨 Security Alert: User ${req.user.id} attempted to verify transaction ${transaction.id} belonging to user ${transaction.user_id}`);
            return res.status(403).json({ success: false, error: 'Unauthorized: Transaction does not belong to you' });
        }

        // SECURITY: Replay attack protection - check if already fulfilled
        if (transaction.status === 'completed' || transaction.status === 'processing') {
            console.log(`🛡️ Replay Prevention: Transaction ${transaction.id} is already ${transaction.status}. Returning success state.`);
            return res.json({
                success: true,
                status: transaction.status,
                message: transaction.status === 'completed'
                    ? `Data bundle delivered: ${transaction.data_amount}`
                    : `Order processing`,
                transaction_id: transaction.id,
            });
        }

        // SECURITY: Verify currency and amount matches expected transaction amount in pesewas
        const expectedPesewas = Math.round(parseFloat(transaction.amount_ghc) * 100);
        if (verifyData.data.currency !== 'GHS' || verifyData.data.amount !== expectedPesewas) {
            console.error(`🚨 Security Alert: Amount/Currency mismatch on transaction ${transaction.id}. Expected: ${expectedPesewas} GHS pesewas, Received: ${verifyData.data.amount} ${verifyData.data.currency}`);
            await connection.execute(
                `UPDATE transactions SET status = 'failed', api_response = ? WHERE id = ?::uuid`,
                [JSON.stringify({ error: 'Amount or currency mismatch', verifyData }), transaction.id]
            );
            return res.status(400).json({ success: false, error: 'Payment verification failed: Amount or currency mismatch' });
        }

        // Update transaction to processing
        await connection.execute(
            `UPDATE transactions SET status = 'processing' WHERE id = ?::uuid`,
            [transaction.id]
        );

        // Call Sourcing API router to place data bundle order using bundle provider or fallback
        const fulfillment = await placeDataOrder({
            network: transaction.network,
            dataAmount: transaction.data_amount,
            recipientPhone: transaction.recipient_phone,
            transactionId: transaction.id,
            providerSlug: transaction.provider_slug || transaction.source_provider
        });

        const finalStatus = fulfillment.status;
        const orderData = fulfillment.apiResponse;

        // Check if network is unavailable or fulfillment failed
        if (fulfillment.networkUnavailable || finalStatus === 'failed') {
            // Trigger automated refund to credit user's wallet
            await processAutomatedRefund({
                transactionId: transaction.id,
                userId: transaction.user_id,
                amountGhc: transaction.amount_ghc,
                reason: fulfillment.message || 'Data bundle delivery failed'
            });

            await connection.execute(
                `UPDATE transactions SET status = 'refunded', paid = 'refunded', api_response = ? WHERE id = ?::uuid`,
                [JSON.stringify({
                    paystack: verifyData,
                    error: fulfillment.error || fulfillment.message,
                    networkUnavailable: !!fulfillment.networkUnavailable
                }), transaction.id]
            );

            return res.json({
                success: false,
                status: 'refunded',
                message: `${fulfillment.message || 'Data delivery failed'}. GHS ${parseFloat(transaction.amount_ghc).toFixed(2)} has been refunded to your wallet.`,
                networkUnavailable: !!fulfillment.networkUnavailable,
                transaction_id: transaction.id,
            });
        }

        // Update transaction with final status and provider identifiers
        const combinedApiResponse = {
            paystack: verifyData,
            datahouse: orderData,
            portal02: orderData,
            providerPublicId: fulfillment.providerPublicId || fulfillment.orderId,
            providerReferenceCode: fulfillment.providerReferenceCode || fulfillment.orderReference,
            orderId: fulfillment.orderId
        };
        await connection.execute(
            `UPDATE transactions SET status = ?, api_response = ? WHERE id = ?::uuid`,
            [finalStatus, JSON.stringify(combinedApiResponse), transaction.id]
        );

        // Record in MTN Beneficiary Approval system if pending MTN approval & purge from transactions
        if (finalStatus === 'pending_mtn_approval') {
            console.log(`📱 [PAYSTACK VERIFY] Transaction ${transaction.id} requires Pending MTN Approval. Purging from transactions table.`);
            const { recordPendingBeneficiary } = require('../services/mtnApproval.service');
            await recordPendingBeneficiary({
                phone: transaction.recipient_phone,
                network: transaction.network || 'MTN',
                bundleSize: transaction.data_amount || 'Unknown',
                source: 'Web App',
                orderId: transaction.id,
                orderReference: reference
            }).catch(err => console.warn('⚠️ Record pending beneficiary warning:', err.message));

            // Purge transaction so NO order record exists in transactions table
            await connection.execute('DELETE FROM transactions WHERE id = ?::uuid', [transaction.id]);

            return res.json({
                success: true,
                status: 'pending_mtn_approval',
                message: 'Awaiting MTN Approval — This recipient\'s MTN number requires approval before data can be delivered.'
            });
        }

        // Emit real-time transaction update via Socket.IO
        const io = req.app.get('io');
        io.to(transaction.user_id).emit('transactionUpdate', {
            id: transaction.id,
            status: finalStatus,
            message: finalStatus === 'completed'
                ? `Data bundle delivered: ${transaction.data_amount}`
                : `Order ${finalStatus}`
        });

        res.json({
            success: true,
            status: finalStatus,
            message: finalStatus === 'completed'
                ? `Data bundle delivered: ${transaction.data_amount} to ${transaction.recipient_phone}`
                : finalStatus === 'processing'
                    ? `Order placed and processing: ${transaction.data_amount} to ${transaction.recipient_phone}`
                    : 'Data bundle delivery failed',
            transaction_id: transaction.id,
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ success: false, error: error.message || 'Payment verification failed' });
    } finally {
        if (connection) connection.release();
    }
};

// Paystack webhook handler
exports.paystackWebhook = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        const signature = req.headers['x-paystack-signature'];

        // Use rawBody if available (more reliable for signature verification)
        const bodyContent = req.rawBody ? req.rawBody : JSON.stringify(req.body);

        const crypto = require('crypto');
        const hash = crypto
            .createHmac('sha512', secret || '')
            .update(bodyContent)
            .digest('hex');

        // Timing-safe comparison to prevent side-channel timing attacks
        const hashBuffer = Buffer.from(hash, 'hex');
        const sigBuffer = Buffer.from(signature || '', 'hex');

        if (hashBuffer.length !== sigBuffer.length || !crypto.timingSafeEqual(hashBuffer, sigBuffer)) {
            console.error('❌ Webhook: Invalid signature');
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const event = req.body;

        if (event.event === 'charge.success') {
            const reference = event.data.reference;
            const amount = event.data.amount / 100; // Convert from pesewas to GHC

            if (reference.startsWith('ACT-')) {
                // Agent Store Activation Payment (GHS 100)
                const storeId = event.data.metadata?.store_id;
                console.log(`🛍️ Webhook: Verifying Agent Store Activation for store ${storeId}, reference ${reference}`);

                await connection.execute(
                    `UPDATE agent_store_activation_payments SET status = 'completed', paid_at = NOW() WHERE paystack_reference = ?`,
                    [reference]
                );

                if (storeId) {
                    await connection.execute(
                        `UPDATE agent_stores SET activation_status = 'PAID', updated_at = NOW() WHERE id = ?::uuid`,
                        [storeId]
                    );
                    console.log(`✅ Webhook: Agent Store ${storeId} marked as PAID`);
                }
            } else if (reference.startsWith('AG-ORD-')) {
                // Agent Store Customer Purchase
                console.log(`🛒 Webhook: Processing Agent Customer Purchase for reference ${reference}`);
                let [orders] = await connection.execute(
                    `SELECT o.*, b.provider_slug 
                     FROM agent_orders o
                     LEFT JOIN data_bundles b ON o.bundle_id = b.id::uuid
                     WHERE o.paystack_reference = ?`,
                    [reference]
                );

                let order;

                // Lazy order creation if webhook arrives before frontend verify call
                if (orders.length === 0) {
                    const meta = event.data.metadata || {};
                    if (meta.store_id && meta.agent_id && meta.bundle_id && meta.customer_phone) {
                        const orderId = uuidv4();
                        const sellingPrice = parseFloat(meta.selling_price_ghc || (event.data.amount / 100));
                        const basePrice = parseFloat(meta.base_price_ghc || 0);
                        const profit = parseFloat(meta.profit_ghc || Math.max(0, sellingPrice - basePrice));

                        const [bundleRows] = await connection.execute('SELECT provider_slug FROM data_bundles WHERE id = ?::uuid', [meta.bundle_id]);
                        const providerSlug = bundleRows.length > 0 ? bundleRows[0].provider_slug : null;

                        await connection.execute(
                            `INSERT INTO agent_orders (id, store_id, agent_id, bundle_id, customer_phone, network, data_amount, base_price_ghc, selling_price_ghc, profit_ghc, paystack_reference, payment_status, fulfillment_status, created_at, updated_at)
                             VALUES (?::uuid, ?::uuid, ?::uuid, ?::uuid, ?, ?, ?, ?, ?, ?, ?, 'paid', 'processing', NOW(), NOW())`,
                            [orderId, meta.store_id, meta.agent_id, meta.bundle_id, meta.customer_phone, meta.network, meta.data_amount, basePrice, sellingPrice, profit, reference]
                        );

                        order = {
                            id: orderId,
                            store_id: meta.store_id,
                            agent_id: meta.agent_id,
                            bundle_id: meta.bundle_id,
                            customer_phone: meta.customer_phone,
                            network: meta.network,
                            data_amount: meta.data_amount,
                            base_price_ghc: basePrice,
                            selling_price_ghc: sellingPrice,
                            profit_ghc: profit,
                            paystack_reference: reference,
                            payment_status: 'paid',
                            fulfillment_status: 'processing',
                            provider_slug: providerSlug
                        };
                    }
                } else {
                    order = orders[0];
                }

                if (order && order.fulfillment_status !== 'completed' && order.fulfillment_status !== 'processing') {
                    await connection.execute(
                        `UPDATE agent_orders SET payment_status = 'paid', fulfillment_status = 'processing', updated_at = NOW() WHERE id = ?::uuid`,
                        [order.id]
                    );

                    const fulfillment = await placeDataOrder({
                        network: order.network,
                        dataAmount: order.data_amount,
                        recipientPhone: order.customer_phone,
                        transactionId: order.id,
                        providerSlug: order.provider_slug
                    });

                    if (fulfillment.status === 'completed') {
                        await connection.beginTransaction();

                        await connection.execute(
                            `UPDATE agent_orders SET fulfillment_status = 'completed', updated_at = NOW() WHERE id = ?::uuid`,
                            [order.id]
                        );

                        const profitGhc = parseFloat(order.profit_ghc);
                        const [wallets] = await connection.execute('SELECT available_balance FROM agent_wallets WHERE agent_id = ?::uuid', [order.agent_id]);
                        const currentAvail = wallets.length > 0 ? parseFloat(wallets[0].available_balance) : 0.00;
                        const newAvail = currentAvail + profitGhc;

                        await connection.execute(
                            `UPDATE agent_wallets 
                             SET available_balance = available_balance + ?,
                                 total_profit_earned = total_profit_earned + ?,
                                 updated_at = NOW()
                             WHERE agent_id = ?::uuid`,
                            [profitGhc, profitGhc, order.agent_id]
                        );

                        await connection.execute(
                            `INSERT INTO agent_wallet_ledger (id, agent_id, store_id, order_id, type, amount_ghc, balance_after, description, reference, created_at)
                             VALUES (?::uuid, ?::uuid, ?::uuid, ?::uuid, 'SALE_PROFIT', ?, ?, ?, ?, NOW())`,
                            [uuidv4(), order.agent_id, order.store_id, order.id, profitGhc, newAvail, `Markup profit for ${order.network} ${order.data_amount} sale`, reference]
                        );

                        await connection.commit();
                    } else if (fulfillment.status === 'pending_mtn_approval') {
                        console.log(`📱 [PAYSTACK WEBHOOK] Order ${order.id} requires Pending MTN Approval. Purging from agent_orders.`);
                        const { recordPendingBeneficiary } = require('../services/mtnApproval.service');
                        await recordPendingBeneficiary({
                            phone: order.customer_phone,
                            network: order.network,
                            bundleSize: order.data_amount,
                            source: 'Agent Store (Webhook)',
                            orderId: order.id,
                            orderReference: reference
                        }).catch(err => console.warn('⚠️ Record pending beneficiary warning:', err.message));

                        // Purge order record so NO record exists in normal order tables
                        await connection.execute(`DELETE FROM agent_orders WHERE id = ?::uuid`, [order.id]);
                    } else {
                        await connection.execute(
                            `UPDATE agent_orders SET fulfillment_status = 'failed', updated_at = NOW() WHERE id = ?::uuid`,
                            [order.id]
                        );
                    }
                }
            } else if (reference.startsWith('DEP-')) {
                // This is a wallet deposit
                const userId = event.data.metadata?.user_id;

                if (userId) {
                    // Fee deduction logic: The user pays (Amount + 3% Fee). 
                    // To get the net amount to credit, we divide total by 1.03
                    const feePercentage = 0.03;
                    const netAmount = amount / (1 + feePercentage);

                    console.log(`💰 Webhook: Crediting wallet for deposit ${reference}. Total Paid: ₵${amount}, Net to Credit: ₵${netAmount.toFixed(2)}`);

                    // Start transaction for atomicity
                    const walletConn = await pool.getConnection();
                    try {
                        await walletConn.beginTransaction();

                        // Check if deposit already processed to avoid double crediting
                        const [existing] = await walletConn.execute('SELECT id FROM deposits WHERE reference = ?', [reference]);

                        if (existing.length === 0) {
                            const depositId = uuidv4();
                            // Create deposit record
                            await walletConn.execute(
                                'INSERT INTO deposits (id, user_id, amount_ghc, reference, status) VALUES (?::uuid, ?::uuid, ?, ?, ?)',
                                [depositId, userId, netAmount, reference, 'completed']
                            );

                            // Update wallet balance in profiles
                            await walletConn.execute(
                                'UPDATE profiles SET wallet_balance = wallet_balance + ? WHERE id = ?::uuid',
                                [netAmount, userId]
                            );

                            // Update wallet balance in users (redundant but kept for sync)
                            await walletConn.execute(
                                'UPDATE users SET wallet_balance = wallet_balance + ? WHERE uuid = ?::uuid',
                                [netAmount, userId]
                            );

                            await walletConn.commit();

                            // Emit real-time balance update
                            const io = req.app.get('io');
                            if (io) {
                                const [profile] = await pool.execute('SELECT wallet_balance FROM profiles WHERE id = ?::uuid', [userId]);
                                if (profile.length > 0) {
                                    io.to(userId).emit('balanceUpdate', {
                                        newBalance: parseFloat(profile[0].wallet_balance)
                                    });
                                }
                            }
                        } else {
                            console.log(`ℹ️ Webhook: Deposit ${reference} already processed.`);
                        }
                    } catch (err) {
                        await walletConn.rollback();
                        console.error(`❌ Webhook: Failed to credit wallet for ${reference}:`, err);
                    } finally {
                        if (walletConn) walletConn.release();
                    }
                }
            } else {
                // This is a data bundle purchase
                // Get transaction details first
                const [transactions] = await connection.execute(
                    `SELECT t.*, b.network, b.data_amount, b.provider_slug 
                     FROM transactions t 
                     LEFT JOIN data_bundles b ON t.bundle_id = b.id::uuid 
                     WHERE t.paystack_reference = ?`,
                    [reference]
                );

                if (transactions.length > 0) {
                    const transaction = transactions[0];

                    // Only place order if not already completed or ongoing
                    if (transaction.status !== 'completed' && transaction.status !== 'ongoing') {
                        // Mark as processing to avoid duplicate handling
                        await connection.execute(
                            `UPDATE transactions SET status = 'processing' WHERE id = ?::uuid`,
                            [transaction.id]
                        );

                        console.log(`🚀 [Webhook] Placing order inline for transaction ${transaction.id} via webhook...`);

                        // Call Sourcing API router to place data bundle order
                        const fulfillment = await placeDataOrder({
                            network: transaction.network,
                            dataAmount: transaction.data_amount,
                            recipientPhone: transaction.recipient_phone,
                            transactionId: transaction.id,
                            providerSlug: transaction.provider_slug || transaction.source_provider
                        });

                        const finalStatus = fulfillment.status;
                        const orderData = fulfillment.apiResponse;

                        if (fulfillment.networkUnavailable || finalStatus === 'failed') {
                            await processAutomatedRefund({
                                transactionId: transaction.id,
                                userId: transaction.user_id,
                                amountGhc: transaction.amount_ghc,
                                reason: fulfillment.message || 'Data bundle delivery failed'
                            });

                            await connection.execute(
                                `UPDATE transactions SET status = 'refunded', paid = 'refunded', api_response = ? WHERE id = ?::uuid`,
                                [JSON.stringify({
                                    paystack: event,
                                    error: fulfillment.error || fulfillment.message,
                                    networkUnavailable: !!fulfillment.networkUnavailable
                                }), transaction.id]
                            );
                        } else {
                            await connection.execute(
                                `UPDATE transactions SET status = ?, api_response = ? WHERE id = ?::uuid`,
                                [finalStatus, JSON.stringify({ paystack: event, portal02: orderData }), transaction.id]
                            );
                        }

                        // Emit socket update
                        const io = req.app.get('io');
                        if (io) {
                            io.to(transaction.user_id).emit('transactionUpdate', {
                                id: transaction.id,
                                status: fulfillment.networkUnavailable || finalStatus === 'failed' ? 'refunded' : finalStatus,
                                message: fulfillment.networkUnavailable || finalStatus === 'failed'
                                    ? `Order failed. GH₵${parseFloat(transaction.amount_ghc).toFixed(2)} refunded to your wallet.`
                                    : finalStatus === 'completed'
                                        ? `Data bundle delivered: ${transaction.data_amount}`
                                        : `Order ${finalStatus}`
                            });
                        }
                    } else {
                        console.log(`🛡️ [Webhook] Replay Prevention: Transaction ${transaction.id} is already ${transaction.status}. Skipping order placement.`);
                    }
                } else {
                    console.error(`❌ Webhook: Transaction for reference ${reference} not found`);
                }
            }
        }

        res.status(200).json({ received: true });

    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    } finally {
        if (connection) connection.release();
    }
};

// Get payment status
exports.getPaymentStatus = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { reference } = req.params;

        const [transactions] = await connection.execute(
            `SELECT t.id, t.status, t.amount_ghc, t.recipient_phone, t.created_at,
                    b.network, b.data_amount
             FROM transactions t
             LEFT JOIN data_bundles b ON t.bundle_id = b.id::uuid
             WHERE t.paystack_reference = ?`,
            [reference]
        );

        if (transactions.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json(transactions[0]);

    } catch (error) {
        console.error('Get payment status error:', error);
        res.status(500).json({ error: 'Failed to get payment status' });
    } finally {
        if (connection) connection.release();
    }
};
