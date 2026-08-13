const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { normalizePhone, listBeneficiaries } = require('../integrations/datahouse');

/**
 * Record a beneficiary phone number in the Pending MTN Approval workflow.
 * Normalizes phone number, aggregates duplicate occurrences, bundle sizes, and sources.
 * Synchronizes with DataHouse's authoritative beneficiary registry.
 */
const recordPendingBeneficiary = async ({
    phone,
    network = 'MTN',
    bundleSize = 'Unknown',
    source = 'DASHBOARD',
    userId = null,
    agentId = null,
    agentStoreId = null,
    orderId = null,
    orderReference = null,
    datahouseReference = null,
    datahouseStatus = 'pending',
    datahouseSyncStatus = null,
    datahouseSyncError = null
}) => {
    if (!phone) return null;
    const normalizedPhone = normalizePhone(phone);
    const displayPhone = phone.startsWith('0') ? phone : (phone.startsWith('233') ? `0${phone.slice(3)}` : phone);
    const calculatedSyncStatus = datahouseSyncStatus || (datahouseReference ? 'synced' : 'pending');

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Check if beneficiary already exists in mtn_beneficiary_approvals
        const [existing] = await connection.execute(
            `SELECT id, occurrences, bundle_sizes, sources, datahouse_reference, datahouse_sync_status, user_id, agent_id, agent_store_id 
             FROM mtn_beneficiary_approvals WHERE msisdn = ?`,
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
            } catch { currentBundleSizes = []; }
            if (bundleSize && !currentBundleSizes.includes(bundleSize)) {
                currentBundleSizes.push(bundleSize);
            }

            let currentSources = [];
            try {
                currentSources = typeof existing[0].sources === 'string' 
                    ? JSON.parse(existing[0].sources) 
                    : (existing[0].sources || []);
            } catch { currentSources = []; }
            if (source && !currentSources.includes(source)) {
                currentSources.push(source);
            }

            const updatedDhRef = datahouseReference || existing[0].datahouse_reference || null;
            const updatedDhSyncStatus = datahouseReference ? 'synced' : (datahouseSyncStatus || existing[0].datahouse_sync_status || 'pending');

            const updatedUserId = userId || existing[0].user_id || null;
            const updatedAgentId = agentId || existing[0].agent_id || null;
            const updatedStoreId = agentStoreId || existing[0].agent_store_id || null;

            await connection.execute(
                `UPDATE mtn_beneficiary_approvals
                 SET occurrences = ?,
                     bundle_sizes = ?::jsonb,
                     sources = ?::jsonb,
                     user_id = COALESCE(?, user_id),
                     agent_id = COALESCE(?, agent_id),
                     agent_store_id = COALESCE(?, agent_store_id),
                     datahouse_reference = COALESCE(?, datahouse_reference),
                     datahouse_status = COALESCE(?, datahouse_status),
                     datahouse_sync_status = ?,
                     datahouse_sync_error = ?,
                     datahouse_last_sync_at = CURRENT_TIMESTAMP,
                     last_detected_at = CURRENT_TIMESTAMP
                 WHERE id = ?::uuid`,
                [
                    currentOccurrences,
                    JSON.stringify(currentBundleSizes),
                    JSON.stringify(currentSources),
                    updatedUserId,
                    updatedAgentId,
                    updatedStoreId,
                    updatedDhRef,
                    datahouseStatus,
                    updatedDhSyncStatus,
                    datahouseSyncError || null,
                    approvalId
                ]
            );
        } else {
            approvalId = uuidv4();
            await connection.execute(
                `INSERT INTO mtn_beneficiary_approvals
                 (id, msisdn, display_phone, network, status, occurrences, bundle_sizes, sources, primary_source,
                  user_id, agent_id, agent_store_id,
                  datahouse_reference, datahouse_status, datahouse_sync_status, datahouse_sync_error, datahouse_last_sync_at,
                  first_detected_at, last_detected_at)
                 VALUES (?::uuid, ?, ?, ?, 'pending', 1, ?::jsonb, ?::jsonb, ?, ?::uuid, ?::uuid, ?::uuid, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                    approvalId,
                    normalizedPhone,
                    displayPhone,
                    network.toUpperCase(),
                    JSON.stringify([bundleSize]),
                    JSON.stringify([source]),
                    source,
                    userId || null,
                    agentId || null,
                    agentStoreId || null,
                    datahouseReference || null,
                    datahouseStatus || 'pending',
                    calculatedSyncStatus,
                    datahouseSyncError || null
                ]
            );
        }

        // 2. Link this specific order instance in mtn_beneficiary_approval_orders
        await connection.execute(
            `INSERT INTO mtn_beneficiary_approval_orders
             (id, approval_id, order_id, order_reference, bundle_size, source, user_id, agent_id, agent_store_id, created_at)
             VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?, ?, ?::uuid, ?::uuid, ?::uuid, CURRENT_TIMESTAMP)`,
            [
                uuidv4(),
                approvalId,
                orderId || null,
                orderReference || `REF-${Date.now()}`,
                bundleSize,
                source,
                userId || null,
                agentId || null,
                agentStoreId || null
            ]
        );

        await connection.commit();
        console.log(`📱 Recorded pending MTN approval for ${displayPhone} (Source: ${source}, Bundle: ${bundleSize})`);

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
 * Synchronize local beneficiary approval states with authoritative DataHouse GET /agent/beneficiaries
 */
const syncBeneficiaryApprovals = async () => {
    try {
        console.log('🔄 [MTN Sync] Reconciling beneficiary approvals with DataHouse...');

        // Fetch active pending/submitted records from local DB
        const [localRecords] = await pool.execute(
            `SELECT id, msisdn, display_phone, status, datahouse_reference 
             FROM mtn_beneficiary_approvals WHERE status IN ('pending', 'submitted')`
        );

        if (localRecords.length === 0) {
            return { updated: 0 };
        }

        const dhResponse = await listBeneficiaries({ limit: 100 });
        if (!dhResponse.ok) {
            console.warn('⚠️ [MTN Sync] DataHouse listBeneficiaries returned non-success:', dhResponse.error);
            return { updated: 0, error: dhResponse.error };
        }

        const remoteList = Array.isArray(dhResponse.data) ? dhResponse.data : (dhResponse.data?.items || dhResponse.data?.data || []);
        let totalUpdated = 0;

        for (const localRec of localRecords) {
            const match = remoteList.find(r => {
                const rPhone = normalizePhone(r.phoneNumber || r.phone || r.msisdn || '');
                const rRef = r.id || r.reference || r.publicId || null;
                return rPhone === localRec.msisdn || (rRef && rRef === localRec.datahouse_reference);
            });

            if (!match) continue;

            const remoteStatus = (match.status || (match.approved ? 'approved' : (match.rejected ? 'rejected' : 'pending'))).toLowerCase().trim();
            const remoteRef = match.id || match.reference || match.publicId || localRec.datahouse_reference || null;

            if (remoteStatus === 'approved' && localRec.status !== 'approved') {
                await pool.execute(
                    `UPDATE mtn_beneficiary_approvals
                     SET status = 'approved',
                         datahouse_status = 'approved',
                         datahouse_reference = COALESCE(?, datahouse_reference),
                         datahouse_sync_status = 'synced',
                         datahouse_last_sync_at = CURRENT_TIMESTAMP,
                         approved_at = CURRENT_TIMESTAMP,
                         resolved_at = CURRENT_TIMESTAMP
                     WHERE id = ?::uuid`,
                    [remoteRef, localRec.id]
                );
                totalUpdated++;
            } else if (remoteStatus === 'rejected' && localRec.status !== 'rejected') {
                await pool.execute(
                    `UPDATE mtn_beneficiary_approvals
                     SET status = 'rejected',
                         datahouse_status = 'rejected',
                         datahouse_reference = COALESCE(?, datahouse_reference),
                         datahouse_sync_status = 'synced',
                         datahouse_last_sync_at = CURRENT_TIMESTAMP,
                         rejected_at = CURRENT_TIMESTAMP,
                         resolved_at = CURRENT_TIMESTAMP
                     WHERE id = ?::uuid`,
                    [remoteRef, localRec.id]
                );
                totalUpdated++;
            }
        }

        if (totalUpdated > 0 && global.io) {
            global.io.emit('mtnApprovalUpdate');
        }

        return { updated: totalUpdated };
    } catch (error) {
        console.error('❌ Error syncing MTN beneficiary approvals:', error);
        return { updated: 0, error: error.message };
    }
};

module.exports = {
    recordPendingBeneficiary,
    syncBeneficiaryApprovals
};
