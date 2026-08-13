const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { logActivity } = require('./activityLogger');

/**
 * Atomic helper to process automated refunds for failed orders.
 * Ensures the wallet balance update and refund log insertion (in `refunds` or `partner_ledger`)
 * occur within a single database transaction. If the transaction rolls back, no refund entry is created.
 */
const processAutomatedRefund = async ({ transactionId, userId = null, partnerId = null, amountGhc = null, reason = 'Automated refund for failed order', isPartial = false }) => {
    if (!transactionId) {
        return { success: false, error: 'Transaction ID is required for automated refund' };
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Lock transaction row for UPDATE to prevent concurrent refunding
        const [txRows] = await connection.execute(
            'SELECT id, user_id, partner_id, amount_ghc, status, paid FROM transactions WHERE id = ?::uuid FOR UPDATE',
            [transactionId]
        );

        if (txRows.length === 0) {
            await connection.rollback();
            connection.release();
            return { success: false, error: 'Transaction not found' };
        }

        const tx = txRows[0];

        // Only refund charged/paid orders. Unpaid/failed payments do NOT require a refund.
        if (tx.status === 'pending_payment' || tx.paid === 'no') {
            console.log(`ℹ️ [REFUND HELPER] Transaction ${transactionId} was never charged (status: ${tx.status}, paid: ${tx.paid}). Skipping refund.`);
            await connection.rollback();
            connection.release();
            return { success: false, reason: 'Transaction was not charged' };
        }

        const targetUserId = userId || tx.user_id;
        const targetPartnerId = partnerId || tx.partner_id;
        // Calculate refund amount: use custom amount for partial refunds, else full transaction amount
        const refundAmount = (amountGhc !== null && parseFloat(amountGhc) > 0)
            ? Math.min(parseFloat(amountGhc), parseFloat(tx.amount_ghc || 0))
            : parseFloat(tx.amount_ghc || 0);

        if (refundAmount <= 0) {
            await connection.rollback();
            connection.release();
            return { success: false, error: 'Refund amount must be greater than zero' };
        }

        // 2. Check if transaction has ALREADY been fully refunded
        let alreadyRefunded = tx.status === 'refunded' || tx.paid === 'refunded';

        if (!alreadyRefunded && targetUserId && !isPartial) {
            const [existingRefunds] = await connection.execute(
                "SELECT id FROM refunds WHERE notes LIKE ?",
                [`%${transactionId}%`]
            );
            if (existingRefunds.length > 0) alreadyRefunded = true;
        }

        if (!alreadyRefunded && targetPartnerId && !isPartial) {
            const [existingLedger] = await connection.execute(
                "SELECT id FROM partner_ledger WHERE reference = ?::uuid AND type = 'refund'",
                [transactionId]
            );
            if (existingLedger.length > 0) alreadyRefunded = true;
        }

        if (alreadyRefunded) {
            console.log(`ℹ️ [REFUND HELPER] Transaction ${transactionId} has already been refunded.`);
            await connection.rollback();
            connection.release();
            return { success: false, reason: 'Already refunded' };
        }

        // 3. Mark transaction as REFUNDED or PARTIALLY_REFUNDED
        if (isPartial) {
            await connection.execute(
                "UPDATE transactions SET paid = 'partially_refunded', failure_reason = COALESCE(failure_reason, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid",
                [reason, transactionId]
            );
        } else {
            await connection.execute(
                "UPDATE transactions SET status = 'refunded', paid = 'refunded', failure_reason = COALESCE(failure_reason, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid",
                [reason, transactionId]
            );
        }

        // Check matching agent_orders and update status & handle profit reversal if applicable
        const [agentOrders] = await connection.execute(
            'SELECT id, agent_id, store_id, profit_ghc, fulfillment_status FROM agent_orders WHERE paystack_reference = ? OR id = ?::uuid FOR UPDATE',
            [tx.paystack_reference || transactionId, transactionId]
        );

        if (agentOrders.length > 0) {
            const agentOrder = agentOrders[0];
            if (agentOrder.fulfillment_status === 'completed') {
                const profitToReverse = parseFloat(agentOrder.profit_ghc || 0);
                if (profitToReverse > 0) {
                    await connection.execute(
                        'UPDATE agent_wallets SET available_balance = available_balance - ?, total_profit_earned = total_profit_earned - ?, updated_at = CURRENT_TIMESTAMP WHERE agent_id = ?::uuid',
                        [profitToReverse, profitToReverse, agentOrder.agent_id]
                    );
                    await connection.execute(
                        `INSERT INTO agent_wallet_ledger (id, agent_id, store_id, order_id, type, amount_ghc, balance_after, description, reference, created_at)
                         VALUES (?::uuid, ?::uuid, ?::uuid, ?::uuid, 'PROFIT_REVERSAL', ?, (SELECT available_balance FROM agent_wallets WHERE agent_id = ?::uuid), ?, ?, NOW())`,
                        [uuidv4(), agentOrder.agent_id, agentOrder.store_id, agentOrder.id, -profitToReverse, agentOrder.agent_id, `Profit reversal for refunded order #${agentOrder.id.slice(0, 8)}`, tx.paystack_reference || transactionId]
                    );
                }
            }

            await connection.execute(
                'UPDATE agent_orders SET fulfillment_status = \'refunded\', payment_status = \'refunded\', updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                [agentOrder.id]
            );
        }

        // 4. Perform wallet balance credit & refund log insertion
        if (targetUserId) {
            // Lock user profile
            await connection.execute('SELECT id FROM profiles WHERE id = ?::uuid FOR UPDATE', [targetUserId]);

            // Update profile balance
            await connection.execute(
                'UPDATE profiles SET wallet_balance = wallet_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                [refundAmount, targetUserId]
            );

            // Update user balance (keep in sync)
            await connection.execute(
                'UPDATE users SET wallet_balance = wallet_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE uuid = ?::uuid',
                [refundAmount, targetUserId]
            );

            // Insert into refunds table
            const refundId = uuidv4();
            const noteText = `Refund for failed order #${transactionId.slice(0, 8)} [${transactionId}] (${reason})`;
            await connection.execute(
                'INSERT INTO refunds (id, user_id, amount_ghc, notes) VALUES (?::uuid, ?::uuid, ?, ?)',
                [refundId, targetUserId, refundAmount, noteText]
            );

            // Send in-app notification confirming refund completion
            await connection.execute(
                `INSERT INTO notifications (id, user_id, title, message, type)
                 VALUES (?::uuid, ?::uuid, 'Order Refunded', ?, 'info')`,
                [
                    uuidv4(),
                    targetUserId,
                    `Your order #${transactionId.slice(0, 8)} could not be completed and GHS ${refundAmount.toFixed(2)} has been successfully refunded to your wallet.`
                ]
            );
        } else if (targetPartnerId) {
            // Lock partner row
            const [partnerRows] = await connection.execute(
                'SELECT id, credit_enabled, allow_unlimited_purchases FROM partners WHERE id = ?::uuid FOR UPDATE',
                [targetPartnerId]
            );

            if (partnerRows.length > 0) {
                const partner = partnerRows[0];
                if (partner.allow_unlimited_purchases || partner.credit_enabled) {
                    await connection.execute(
                        'UPDATE partners SET outstanding_balance = outstanding_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                        [refundAmount, targetPartnerId]
                    );
                } else {
                    await connection.execute(
                        'UPDATE partners SET wallet_balance = wallet_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                        [refundAmount, targetPartnerId]
                    );
                }

                // Insert into partner_ledger
                await connection.execute(
                    `INSERT INTO partner_ledger (partner_id, type, amount, description, reference)
                     VALUES (?::uuid, 'refund', ?, ?, ?::uuid)`,
                    [targetPartnerId, -refundAmount, `Refund for failed order (${reason})`, transactionId]
                );
            }
        }

        await connection.commit();
        connection.release();

        console.log(`✅ [REFUND HELPER] Successfully refunded GH₵${refundAmount.toFixed(2)} for transaction ${transactionId} (Status set to REFUNDED)`);

        // Real-time Socket.IO notification push
        if (global.io && targetUserId) {
            global.io.to(targetUserId).emit('balanceUpdate', { userId: targetUserId, amount: refundAmount });
            global.io.to(targetUserId).emit('newRefund', { userId: targetUserId, amount: refundAmount, transactionId });
            global.io.to(targetUserId).emit('userStatsUpdate', { userId: targetUserId });
            global.io.emit('userStatsUpdate', { userId: targetUserId });
            global.io.emit('transactionUpdate', { transactionId, status: 'refunded', userId: targetUserId });
        }

        // Log activity (non-blocking)
        if (targetUserId) {
            logActivity(targetUserId, 'REFUND', `Automated refund of GH₵${refundAmount.toFixed(2)} for failed order ${transactionId.slice(0, 8)}`, { transactionId, amount: refundAmount, reason }, '127.0.0.1');
        }

        return { success: true, refundedAmount: refundAmount };

    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error(`❌ [REFUND HELPER] Failed to refund transaction ${transactionId}:`, error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Initiate refund directly via Paystack REST API
 */
const processPaystackRefund = async ({ paystackReference, amountGhc, reason = 'Order fulfillment failure refund' }) => {
    try {
        const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!paystackSecretKey) {
            return { success: false, error: 'Paystack secret key is missing' };
        }

        const bodyData = { transaction: paystackReference };
        if (amountGhc && amountGhc > 0) {
            bodyData.amount = Math.round(amountGhc * 100);
        }

        const response = await fetch('https://api.paystack.co/refund', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyData)
        });

        const data = await response.json();
        if (data.status && (data.data?.status === 'processed' || data.data?.status === 'pending' || data.data?.status === 'processing')) {
            return { success: true, paystackData: data.data };
        }

        return { success: false, error: data.message || 'Paystack refund request failed', details: data };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

module.exports = { processAutomatedRefund, processPaystackRefund };
