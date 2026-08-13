const pool = require('../config/database');
const { getOrderById: getDhOrderById } = require('../integrations/datahouse');
const { syncBeneficiaryApprovals } = require('../services/mtnApproval.service');
const { processAutomatedRefund } = require('../utils/refundHelper');
const { triggerTransactionWebhook } = require('../services/partnerWebhook.service');

/**
 * DataHouse Authoritative Status Reconciliation Worker
 *
 * Runs periodically to reconcile pending ByteBeacon orders against DataHouse.
 * - Does NOT modify DataHouse state or re-place orders.
 * - Queries DataHouse GET /agent/orders/:id to catch up on any missed webhooks.
 * - Updates local synchronized representation with exact DataHouse statuses.
 * - Triggers refunds on authoritative failures and emits real-time WebSocket events.
 */

let isRunning = false;

const syncPendingTransactions = async (io) => {
    if (isRunning) {
        return;
    }

    isRunning = true;

    try {
        // --- 1. Reconcile Pending MTN Beneficiary Approvals ---
        try {
            await syncBeneficiaryApprovals();
        } catch (beneficiaryErr) {
            console.warn('⚠️ [Status Sync] Beneficiary reconciliation error:', beneficiaryErr.message);
        }

        // --- 2. Reconcile Active/Pending Orders with DataHouse ---
        const [transactions] = await pool.execute(`
            SELECT id, user_id, status, amount_ghc, datahouse_order_id, reference_code, created_at, recipient_phone
            FROM transactions
            WHERE status IN ('received', 'processing', 'ongoing', 'queued', 'pending')
              AND created_at < NOW() - INTERVAL '5 seconds'
            ORDER BY created_at ASC
            LIMIT 50
        `);

        if (transactions.length > 0) {
            console.log(`🔄 [DataHouse Reconciliation] Reconciling ${transactions.length} active orders...`);

            for (const transaction of transactions) {
                try {
                    const identifier = transaction.datahouse_order_id || transaction.reference_code || transaction.id;
                    const res = await getDhOrderById(identifier);

                    if (!res.ok) {
                        // Keep order in current state and retry next cycle
                        continue;
                    }

                    const dhOrder = res.data || {};
                    const dhStatus = dhOrder.status;

                    if (!dhStatus) continue;

                    if (dhStatus !== transaction.status) {
                        console.log(`🔄 [DataHouse Reconciliation] Order ${transaction.id}: ${transaction.status} -> ${dhStatus}`);

                        const dhOrderId = dhOrder.id || dhOrder.publicId || transaction.datahouse_order_id;
                        const dhRef = dhOrder.referenceCode || dhOrder.reference || transaction.reference_code;

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
                            [dhStatus, dhStatus, dhStatus, dhOrderId, dhRef, JSON.stringify(dhOrder), transaction.id]
                        );

                        // If DataHouse marked as failed/rejected, trigger wallet refund
                        if (['failed', 'rejected'].includes(dhStatus) && !['failed', 'rejected'].includes(transaction.status)) {
                            await processAutomatedRefund({
                                transactionId: transaction.id,
                                userId: transaction.user_id,
                                amountGhc: transaction.amount_ghc,
                                reason: `DataHouse reconciliation detected order ${dhStatus}`
                            }).catch(err => console.error('Automated refund error in sync:', err.message));
                        }

                        // Emit WebSocket update to customer and all admin order views
                        if (io) {
                            const syncPayload = {
                                transactionId: transaction.id,
                                orderId: dhOrderId,
                                referenceCode: dhRef,
                                status: dhStatus,
                                datahouseStatus: dhStatus,
                                updatedAt: new Date().toISOString(),
                                message: dhStatus === 'approved'
                                    ? 'Your data bundle has been approved and delivered!'
                                    : dhStatus === 'failed' || dhStatus === 'rejected'
                                        ? 'Data bundle delivery failed. Wallet has been automatically refunded.'
                                        : `Your order is ${dhStatus}.`
                            };

                            if (transaction.user_id) {
                                io.to(transaction.user_id).emit('transactionUpdate', syncPayload);
                            }
                            io.emit('transactionUpdate', syncPayload);
                            io.emit('adminOrderUpdate', syncPayload);
                        }

                        // Trigger partner webhook if applicable
                        triggerTransactionWebhook(transaction.id, dhStatus).catch(() => {});
                    }
                } catch (txErr) {
                    console.warn(`⚠️ [Status Sync] Error reconciling order ${transaction.id}:`, txErr.message);
                }
            }
        }

    } catch (error) {
        console.error('❌ [Status Sync] Worker cycle error:', error.message);
    } finally {
        isRunning = false;
    }
};

const startStatusSyncJob = (io) => {
    console.log('🔄 Initializing DataHouse authoritative background reconciliation job...');
    setTimeout(() => {
        syncPendingTransactions(io).catch(err => console.error('Status sync error:', err.message));
    }, 5000);

    setInterval(() => {
        syncPendingTransactions(io).catch(err => console.error('Status sync error:', err.message));
    }, 60 * 1000);
};

module.exports = {
    syncPendingTransactions,
    startStatusSyncJob
};
