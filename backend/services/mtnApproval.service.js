const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { normalizeGhanaPhone, getBeneficiaryApprovalStatus, placeDataOrder } = require('../utils/datahouse');

/**
 * Record a beneficiary phone number in the Pending MTN Approval workflow.
 * Normalizes phone number, aggregates duplicate occurrences, bundle sizes, and sources.
 */
const recordPendingBeneficiary = async ({ phone, network = 'MTN', bundleSize = 'Unknown', source = 'Order', orderId = null, orderReference }) => {
    if (!phone) return null;
    const normalizedPhone = normalizeGhanaPhone(phone);
    const displayPhone = phone.startsWith('0') ? phone : (phone.startsWith('233') ? `0${phone.slice(3)}` : phone);

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Check if beneficiary already exists in mtn_beneficiary_approvals
        const [existing] = await connection.execute(
            'SELECT id, occurrences, bundle_sizes, sources FROM mtn_beneficiary_approvals WHERE msisdn = ?',
            [normalizedPhone]
        );

        let approvalId;

        if (existing.length > 0) {
            approvalId = existing[0].id;
            const currentOccurrences = (existing[0].occurrences || 1) + 1;
            
            let currentBundleSizes = [];
            try {
                currentBundleSizes = typeof existing[0].bundle_sizes === 'string' 
                    ? JSON.parse(existing[0].bundle_sizes) 
                    : (existing[0].bundle_sizes || []);
            } catch (e) { currentBundleSizes = []; }
            if (bundleSize && !currentBundleSizes.includes(bundleSize)) {
                currentBundleSizes.push(bundleSize);
            }

            let currentSources = [];
            try {
                currentSources = typeof existing[0].sources === 'string' 
                    ? JSON.parse(existing[0].sources) 
                    : (existing[0].sources || []);
            } catch (e) { currentSources = []; }
            if (source && !currentSources.includes(source)) {
                currentSources.push(source);
            }

            await connection.execute(
                `UPDATE mtn_beneficiary_approvals
                 SET occurrences = ?,
                     bundle_sizes = ?::jsonb,
                     sources = ?::jsonb,
                     last_detected_at = CURRENT_TIMESTAMP
                 WHERE id = ?::uuid`,
                [currentOccurrences, JSON.stringify(currentBundleSizes), JSON.stringify(currentSources), approvalId]
            );
        } else {
            approvalId = uuidv4();
            await connection.execute(
                `INSERT INTO mtn_beneficiary_approvals
                 (id, msisdn, display_phone, network, status, occurrences, bundle_sizes, sources, first_detected_at, last_detected_at)
                 VALUES (?::uuid, ?, ?, ?, 'pending', 1, ?::jsonb, ?::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                    approvalId,
                    normalizedPhone,
                    displayPhone,
                    network.toUpperCase(),
                    JSON.stringify([bundleSize]),
                    JSON.stringify([source])
                ]
            );
        }

        // 2. Link this specific order instance in mtn_beneficiary_approval_orders
        await connection.execute(
            `INSERT INTO mtn_beneficiary_approval_orders
             (id, approval_id, order_id, order_reference, bundle_size, source, created_at)
             VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
                uuidv4(),
                approvalId,
                orderId || null,
                orderReference || `REF-${Date.now()}`,
                bundleSize,
                source
            ]
        );

        await connection.commit();
        console.log(`📱 Recorded pending MTN approval for ${displayPhone} (${source}, ${bundleSize})`);
        return approvalId;
    } catch (error) {
        await connection.rollback().catch(() => {});
        console.error('❌ Error recording pending beneficiary:', error);
        return null;
    } finally {
        connection.release();
    }
};

/**
 * Synchronize status of pending MTN beneficiaries with DataHouse GET /agent/beneficiaries API.
 * Automatically unblocks approved beneficiaries and retries order fulfillment.
 */
const syncBeneficiaryApprovals = async () => {
    try {
        console.log('🔄 [MTN Sync] Querying DataHouse for beneficiary approval status updates...');
        
        // Fetch active pending/submitted records from local DB
        const [localRecords] = await pool.execute(
            `SELECT id, msisdn, display_phone, status FROM mtn_beneficiary_approvals WHERE status IN ('pending', 'submitted')`
        );

        if (localRecords.length === 0) {
            console.log('ℹ️ [MTN Sync] No pending MTN beneficiary approvals in local queue.');
            return { updated: 0 };
        }

        // Query DataHouse API
        const dhResponse = await getBeneficiaryApprovalStatus({ network: 'MTN', limit: 100 });
        if (!dhResponse.success || !dhResponse.data) {
            console.warn('⚠️ [MTN Sync] DataHouse getBeneficiaryApprovalStatus returned non-success:', dhResponse.error);
            return { updated: 0, error: dhResponse.error };
        }

        const remoteList = Array.isArray(dhResponse.data) ? dhResponse.data : (dhResponse.data.items || dhResponse.data.data || []);
        let updatedCount = 0;

        for (const localRec of localRecords) {
            const match = remoteList.find(r => {
                const rPhone = normalizeGhanaPhone(r.phoneNumber || r.phone || r.msisdn || '');
                return rPhone === localRec.msisdn;
            });

            if (!match) continue;

            const remoteStatus = (match.status || (match.approved ? 'approved' : (match.rejected ? 'rejected' : 'pending'))).toLowerCase().trim();

            if (remoteStatus === 'approved' && localRec.status !== 'approved') {
                console.log(`🎉 [MTN Sync] Beneficiary ${localRec.display_phone} APPROVED by MTN! Auto-unblocking...`);
                
                await pool.execute(
                    `UPDATE mtn_beneficiary_approvals
                     SET status = 'approved', approved_at = CURRENT_TIMESTAMP, resolved_at = CURRENT_TIMESTAMP
                     WHERE id = ?::uuid`,
                    [localRec.id]
                );

                // Fetch linked orders for auto-unblocking
                const [linkedOrders] = await pool.execute(
                    `SELECT order_id, order_reference, bundle_size, source FROM mtn_beneficiary_approval_orders WHERE approval_id = ?::uuid`,
                    [localRec.id]
                );

                for (const ord of linkedOrders) {
                    // Check agent_orders table
                    const [agentOrderRows] = await pool.execute(
                        `SELECT id, store_id, agent_id, customer_phone, network, data_amount, paystack_reference, fulfillment_status
                         FROM agent_orders WHERE paystack_reference = ? OR id = ?::uuid`,
                        [ord.order_reference, ord.order_id || '00000000-0000-0000-0000-000000000000']
                    );

                    if (agentOrderRows.length > 0 && agentOrderRows[0].fulfillment_status === 'pending_mtn_approval') {
                        const targetOrd = agentOrderRows[0];
                        console.log(`🚀 [MTN Auto-Unblock] Resubmitting Agent Store order ${targetOrd.id}...`);

                        try {
                            const placeRes = await placeDataOrder({
                                network: targetOrd.network,
                                dataAmount: targetOrd.data_amount,
                                recipientPhone: targetOrd.customer_phone,
                                transactionId: targetOrd.paystack_reference
                            });

                            const newFulfillment = placeRes.status || 'processing';
                            await pool.execute(
                                `UPDATE agent_orders
                                 SET fulfillment_status = ?, provider_reference = ?, updated_at = CURRENT_TIMESTAMP
                                 WHERE id = ?::uuid`,
                                [newFulfillment, placeRes.providerPublicId || placeRes.providerReferenceCode || null, targetOrd.id]
                            );
                        } catch (resubErr) {
                            console.error(`❌ Error resubmitting agent order ${targetOrd.id}:`, resubErr.message);
                        }
                    }

                    // Check transactions table (direct customer purchases)
                    const [txRows] = await pool.execute(
                        `SELECT id, reference, phone, network, data_amount, status
                         FROM transactions WHERE reference = ? OR id = ?::uuid`,
                        [ord.order_reference, ord.order_id || '00000000-0000-0000-0000-000000000000']
                    );

                    if (txRows.length > 0 && txRows[0].status === 'pending_mtn_approval') {
                        const targetTx = txRows[0];
                        console.log(`🚀 [MTN Auto-Unblock] Resubmitting Direct customer order ${targetTx.id}...`);

                        try {
                            const placeRes = await placeDataOrder({
                                network: targetTx.network,
                                dataAmount: targetTx.data_amount,
                                recipientPhone: targetTx.phone,
                                transactionId: targetTx.reference
                            });

                            const newStatus = placeRes.status || 'processing';
                            await pool.execute(
                                `UPDATE transactions
                                 SET status = ?, provider_reference = ?, updated_at = CURRENT_TIMESTAMP
                                 WHERE id = ?::uuid`,
                                [newStatus, placeRes.providerPublicId || placeRes.providerReferenceCode || null, targetTx.id]
                            );
                        } catch (resubErr) {
                            console.error(`❌ Error resubmitting direct order ${targetTx.id}:`, resubErr.message);
                        }
                    }
                }

                updatedCount++;

            } else if (remoteStatus === 'rejected' && localRec.status !== 'rejected') {
                console.log(`❌ [MTN Sync] Beneficiary ${localRec.display_phone} REJECTED by MTN.`);

                await pool.execute(
                    `UPDATE mtn_beneficiary_approvals
                     SET status = 'rejected', rejected_at = CURRENT_TIMESTAMP, resolved_at = CURRENT_TIMESTAMP
                     WHERE id = ?::uuid`,
                    [localRec.id]
                );

                // Update linked orders to rejected
                const [linkedOrders] = await pool.execute(
                    `SELECT order_id, order_reference FROM mtn_beneficiary_approval_orders WHERE approval_id = ?::uuid`,
                    [localRec.id]
                );

                for (const ord of linkedOrders) {
                    await pool.execute(
                        `UPDATE agent_orders SET fulfillment_status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE paystack_reference = ? OR id = ?::uuid`,
                        [ord.order_reference, ord.order_id || '00000000-0000-0000-0000-000000000000']
                    );
                    await pool.execute(
                        `UPDATE transactions SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE reference = ? OR id = ?::uuid`,
                        [ord.order_reference, ord.order_id || '00000000-0000-0000-0000-000000000000']
                    );
                }

                updatedCount++;
            } else if (remoteStatus === 'submitted' && localRec.status === 'pending') {
                await pool.execute(
                    `UPDATE mtn_beneficiary_approvals SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE id = ?::uuid`,
                    [localRec.id]
                );
                updatedCount++;
            }
        }

        return { updated: updatedCount };
    } catch (error) {
        console.error('❌ Error syncing MTN beneficiary approvals:', error);
        return { updated: 0, error: error.message };
    }
};

module.exports = {
    recordPendingBeneficiary,
    syncBeneficiaryApprovals
};
