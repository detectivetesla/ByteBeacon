const pool = require('../config/database');
const { v4: uuidv4, validate: uuidValidate } = require('uuid');
const config = require('../config/bulkConfig');
const { createBulkOrder, getOrderById: getDhOrderById, normalizePhone } = require('../integrations/datahouse');

/**
 * DataHouse-Authoritative Bulk Order Ingestion Service
 *
 * Architecture:
 * ByteBeacon ingests the bulk batch from the customer and forwards directly to DataHouse's
 * POST /agent/orders/bulk. DataHouse performs carrier batching, bundle grouping,
 * child order creation, and status management.
 */

/**
 * 1. Submit Bulk Order to DataHouse
 */
const submitBulkOrder = async ({
    userId = null,
    partnerId = null,
    agentId = null,
    bundleId,
    network = 'MTN',
    dataAmount = '1GB',
    recipients = [],
    idempotencyKey = null,
    source = 'DASHBOARD'
}) => {
    if (!Array.isArray(recipients) || recipients.length === 0) {
        return { success: false, statusCode: 400, error: 'Recipients array is required and must not be empty.' };
    }

    const totalRecipients = recipients.length;
    if (totalRecipients > (config?.MAX_BULK_RECIPIENTS || 10000)) {
        return {
            success: false,
            statusCode: 400,
            error: `Bulk submission exceeds maximum limit of ${config?.MAX_BULK_RECIPIENTS || 10000} recipients.`
        };
    }

    // Check existing submission by Idempotency Key
    if (idempotencyKey) {
        const [existingSub] = await pool.execute(
            'SELECT id, public_id, reference_code, status, total_recipients, queued_count, completed_count, failed_count FROM bulk_submissions WHERE idempotency_key = ?',
            [idempotencyKey]
        );
        if (existingSub.length > 0) {
            const sub = existingSub[0];
            return {
                success: true,
                statusCode: 200,
                message: 'Existing batch submission retrieved.',
                data: {
                    submissionId: sub.id,
                    publicId: sub.public_id,
                    referenceCode: sub.reference_code,
                    status: sub.status,
                    totalRecipients: sub.total_recipients,
                    isDuplicate: true
                }
            };
        }
    }

    const submissionId = uuidv4();
    const publicId = `sub_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const referenceCode = `BLK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Prepare recipients payload for DataHouse
    const dhRecipients = recipients.map(r => {
        const phone = typeof r === 'string' ? r : (r.phone || r.phoneNumber || r.msisdn || '');
        const rBundleId = (typeof r === 'object' && (r.bundleId || r.bundle_id)) ? (r.bundleId || r.bundle_id) : bundleId;
        return {
            phoneNumber: normalizePhone(phone),
            bundleId: rBundleId
        };
    });

    console.log(`🚀 [BULK INGESTION] Forwarding ${dhRecipients.length} recipients to DataHouse POST /agent/orders/bulk...`);

    // Forward batch to DataHouse API
    const dhRes = await createBulkOrder({
        network: (network || 'MTN').toUpperCase(),
        recipients: dhRecipients,
        idempotencyKey: submissionId
    });

    const dhData = dhRes.data || {};
    const dhStatus = dhData.status || (dhRes.ok ? 'queued' : 'failed');
    const authoritativeRef = dhData.referenceCode || dhData.reference || referenceCode;
    const authoritativePublicId = dhData.publicId || publicId;

    // Persist bulk submission header in ByteBeacon
    try {
        await pool.execute(
            `INSERT INTO bulk_submissions
             (id, public_id, reference_code, user_id, partner_id, agent_id, network, data_amount, bundle_id, total_recipients, queued_count, status, idempotency_key, source, created_at, last_progress_at)
             VALUES (?::uuid, ?, ?, ?::uuid, ?::uuid, ?::uuid, ?, ?, ?::uuid, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                submissionId,
                authoritativePublicId,
                authoritativeRef,
                userId || null,
                partnerId || null,
                agentId || null,
                network,
                dataAmount,
                (bundleId && uuidValidate(bundleId) ? bundleId : null),
                totalRecipients,
                totalRecipients,
                dhStatus,
                idempotencyKey || submissionId,
                source
            ]
        );
    } catch (dbErr) {
        console.error('❌ Error saving bulk submission to database:', dbErr.message);
    }

    if (!dhRes.ok) {
        return {
            success: false,
            statusCode: dhRes.status || 500,
            error: dhRes.error?.message || 'DataHouse bulk submission failed',
            data: {
                submissionId,
                status: 'failed'
            }
        };
    }

    return {
        success: true,
        statusCode: 202,
        message: 'Bulk order accepted and queued with DataHouse',
        data: {
            submissionId,
            publicId: authoritativePublicId,
            referenceCode: authoritativeRef,
            status: dhStatus,
            totalRecipients,
            queuedRecipients: totalRecipients
        }
    };
};

/**
 * 2. Reconcile Bulk Submission Status against DataHouse
 */
const reconcileBulkSubmission = async (submissionId) => {
    try {
        const [subs] = await pool.execute(
            'SELECT id, public_id, reference_code, status FROM bulk_submissions WHERE id::text = ? OR public_id = ? OR reference_code = ?',
            [submissionId, submissionId, submissionId]
        );

        if (subs.length === 0) return null;
        const sub = subs[0];

        const dhRes = await getDhOrderById(sub.public_id || sub.reference_code || sub.id);
        if (dhRes.ok && dhRes.data?.status) {
            const freshStatus = dhRes.data.status;
            await pool.execute(
                'UPDATE bulk_submissions SET status = ?, last_progress_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                [freshStatus, sub.id]
            );
            return freshStatus;
        }

        return sub.status;
    } catch (err) {
        console.error('Error reconciling bulk submission:', err.message);
        return null;
    }
};

module.exports = {
    submitBulkOrder,
    reconcileBulkSubmission
};
