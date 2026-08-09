const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { logActivity } = require('./activityLogger');

/**
 * Atomic helper to process automated refunds for failed orders.
 * Ensures the wallet balance update and refund log insertion (in `refunds` or `partner_ledger`)
 * occur within a single database transaction. If the transaction rolls back, no refund entry is created.
 */
const processAutomatedRefund = async ({ transactionId, userId = null, partnerId = null, amountGhc = null, reason = 'Automated refund for failed order' }) => {
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
        // Always calculate refund amount strictly from the trusted database transaction record
        const refundAmount = parseFloat(tx.amount_ghc || 0);

        if (refundAmount <= 0) {
            await connection.rollback();
            connection.release();
            return { success: false, error: 'Refund amount must be greater than zero' };
        }

        // 2. Check if a refund record has ALREADY been inserted for this transaction ID
        let alreadyRefunded = tx.paid === 'refunded';

        if (!alreadyRefunded && targetUserId) {
            const [existingRefunds] = await connection.execute(
                "SELECT id FROM refunds WHERE notes LIKE ?",
                [`%${transactionId}%`]
            );
            if (existingRefunds.length > 0) alreadyRefunded = true;
        }

        if (!alreadyRefunded && targetPartnerId) {
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

        // 3. Mark transaction as failed and paid status as refunded
        await connection.execute(
            'UPDATE transactions SET status = \'failed\', paid = \'refunded\', failure_reason = COALESCE(failure_reason, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
            [reason, transactionId]
        );

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

            // Insert into refunds table (ONLY included when transaction commits successfully)
            const refundId = uuidv4();
            const noteText = `Refund for failed order #${transactionId.slice(0, 8)} [${transactionId}] (${reason})`;
            await connection.execute(
                'INSERT INTO refunds (id, user_id, amount_ghc, notes) VALUES (?::uuid, ?::uuid, ?, ?)',
                [refundId, targetUserId, refundAmount, noteText]
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

                // Insert into partner_ledger (ONLY included when transaction commits successfully)
                await connection.execute(
                    `INSERT INTO partner_ledger (partner_id, type, amount, description, reference)
                     VALUES (?::uuid, 'refund', ?, ?, ?::uuid)`,
                    [targetPartnerId, -refundAmount, `Refund for failed order (${reason})`, transactionId]
                );
            }
        }

        await connection.commit();
        connection.release();

        console.log(`✅ [REFUND HELPER] Successfully refunded GH₵${refundAmount.toFixed(2)} for transaction ${transactionId}`);

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

module.exports = { processAutomatedRefund };
