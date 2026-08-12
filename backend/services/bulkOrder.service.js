const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/bulkConfig');
const { normalizeGhanaPhone, precheckBeneficiary, placeDataOrder } = require('../utils/datahouse');
const { recordPendingBeneficiary } = require('./mtnApproval.service');
const { processAutomatedRefund } = require('../utils/refundHelper');

/**
 * Fast Asynchronous Bulk Order Ingestion Service
 * Handles up to 10,000+ recipients per batch safely using chunking & queues.
 */

/**
 * 1. Fast Ingestion: Accept, Persist, & Enqueue (Returns HTTP 202 Accepted)
 */
const submitBulkOrder = async ({
    userId = null,
    partnerId = null,
    agentId = null,
    bundleId,
    network,
    dataAmount,
    recipients = [],
    idempotencyKey = null,
    source = 'API'
}) => {
    if (!Array.isArray(recipients) || recipients.length === 0) {
        return { success: false, statusCode: 400, error: 'Recipients array is required and must not be empty.' };
    }

    const totalRecipients = recipients.length;
    if (totalRecipients > config.MAX_BULK_RECIPIENTS) {
        return {
            success: false,
            statusCode: 400,
            error: `Bulk submission exceeds maximum limit of ${config.MAX_BULK_RECIPIENTS} recipients. (Received: ${totalRecipients})`
        };
    }

    // Check Idempotency Key
    if (idempotencyKey) {
        const [existingSub] = await pool.execute(
            'SELECT id, public_id, reference_code, status, total_recipients, queued_count, completed_count, failed_count, blocked_count, pending_mtn_count FROM bulk_submissions WHERE idempotency_key = ?',
            [idempotencyKey]
        );
        if (existingSub.length > 0) {
            const sub = existingSub[0];
            console.log(`ℹ️ [BULK INGESTION] Duplicate idempotency key ${idempotencyKey}. Returning existing submission ${sub.reference_code}.`);
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
                    queuedRecipients: sub.queued_count,
                    isDuplicate: true
                }
            };
        }
    }

    // Generate submission identifiers
    const submissionId = uuidv4();
    const publicId = `sub_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const referenceCode = `BLK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Insert bulk_submissions header row
        await connection.execute(
            `INSERT INTO bulk_submissions
             (id, public_id, reference_code, user_id, partner_id, agent_id, network, data_amount, bundle_id, total_recipients, queued_count, status, idempotency_key, source, created_at, last_progress_at)
             VALUES (?::uuid, ?, ?, ?::uuid, ?::uuid, ?::uuid, ?, ?, ?::uuid, ?, ?, 'queued', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                submissionId,
                publicId,
                referenceCode,
                userId || null,
                partnerId || null,
                agentId || null,
                network,
                dataAmount,
                bundleId || null,
                totalRecipients,
                totalRecipients,
                idempotencyKey || null,
                source
            ]
        );

        // Bulk insert items in chunks of 500 rows to prevent query parameter limits
        const ITEM_INSERT_BATCH_SIZE = 500;
        let itemIndex = 0;

        for (let i = 0; i < recipients.length; i += ITEM_INSERT_BATCH_SIZE) {
            const batchSlice = recipients.slice(i, i + ITEM_INSERT_BATCH_SIZE);
            const valueRows = [];
            const queryParams = [];

            for (const r of batchSlice) {
                const rawPhone = typeof r === 'string' ? r : (r.phone || r.phoneNumber || r.msisdn || '');
                const normPhone = normalizeGhanaPhone(rawPhone) || rawPhone;
                const itemId = uuidv4();
                const itemKey = idempotencyKey ? `${idempotencyKey}_${itemIndex}_${normPhone}` : `${submissionId}_${itemIndex}_${normPhone}`;

                valueRows.push(`(?::uuid, ?::uuid, ?, ?, ?, ?, ?, 'queued', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
                queryParams.push(
                    itemId,
                    submissionId,
                    itemIndex,
                    rawPhone,
                    normPhone,
                    network,
                    dataAmount,
                    itemKey
                );
                itemIndex++;
            }

            const insertSql = `
                INSERT INTO bulk_submission_items
                (id, submission_id, item_index, recipient_phone, normalized_phone, network, bundle_size, status, idempotency_key, created_at, updated_at)
                VALUES ${valueRows.join(', ')}
                ON CONFLICT (idempotency_key) DO NOTHING
            `;

            await connection.execute(insertSql, queryParams);
        }

        await connection.commit();
        connection.release();

        console.log(`🚀 [BULK INGESTION] Batch ${referenceCode} persisted with ${totalRecipients} recipients. Returning HTTP 202.`);

        // Trigger worker processing asynchronously (non-blocking)
        setImmediate(() => {
            processNextBulkChunk().catch(err => console.error('Worker chunk error:', err.message));
        });

        return {
            success: true,
            statusCode: 202,
            message: 'Batch accepted and queued for processing.',
            data: {
                submissionId,
                publicId,
                referenceCode,
                status: 'queued',
                totalRecipients,
                queuedRecipients: totalRecipients,
                chunkSize: config.BULK_CHUNK_SIZE
            }
        };

    } catch (err) {
        await connection.rollback().catch(() => {});
        connection.release();
        console.error('❌ [BULK INGESTION] Error submitting bulk order:', err);
        return { success: false, statusCode: 500, error: 'Failed to ingest bulk order: ' + err.message };
    }
};

/**
 * 2. Worker Processing: Fetch Next Chunk & Execute Orders in Controlled Batches
 */
let isWorkerRunning = false;

const processNextBulkChunk = async () => {
    if (isWorkerRunning) return;
    isWorkerRunning = true;

    try {
        // Fetch active submission in queued or processing status
        const [activeSubmissions] = await pool.execute(`
            SELECT id, reference_code, user_id, partner_id, agent_id, network, data_amount, bundle_id, source, total_recipients
            FROM bulk_submissions
            WHERE status IN ('queued', 'processing')
            ORDER BY created_at ASC
            LIMIT 1
        `);

        if (activeSubmissions.length === 0) {
            isWorkerRunning = false;
            return;
        }

        const sub = activeSubmissions[0];
        const submissionId = sub.id;

        // Mark submission status as processing
        await pool.execute(
            `UPDATE bulk_submissions SET status = 'processing', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), last_progress_at = CURRENT_TIMESTAMP WHERE id = ?::uuid AND status = 'queued'`,
            [submissionId]
        );

        // Fetch next chunk of queued items
        const [items] = await pool.execute(`
            SELECT id, item_index, recipient_phone, normalized_phone, network, bundle_size, attempt_count
            FROM bulk_submission_items
            WHERE submission_id = ?::uuid AND status = 'queued' AND next_retry_at <= CURRENT_TIMESTAMP
            ORDER BY item_index ASC
            LIMIT ?
        `, [submissionId, config.BULK_CHUNK_SIZE]);

        if (items.length === 0) {
            // Check if all items are done -> Reconcile
            await reconcileBulkSubmission(submissionId);
            isWorkerRunning = false;
            return;
        }

        console.log(`📦 [BULK WORKER] Processing chunk of ${items.length} items for batch ${sub.reference_code}...`);

        // Mark chunk items as processing & update heartbeat
        const itemIds = items.map(it => it.id);
        await pool.execute(
            `UPDATE bulk_submission_items 
             SET status = 'processing', attempt_count = attempt_count + 1, last_heartbeat_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id IN (${itemIds.map(() => '?::uuid').join(',')})`,
            itemIds
        );

        const isMtn = (sub.network || 'MTN').toUpperCase() === 'MTN';

        let completedCount = 0;
        let failedCount = 0;
        let blockedCount = 0;
        let pendingMtnCount = 0;

        if (isMtn) {
            // MTN BATCH: Perform precheck on recipient phone numbers
            const phones = items.map(it => it.recipient_phone);
            console.log(`🔍 [BULK WORKER] Prechecking ${phones.length} MTN recipients for ${sub.reference_code}...`);

            const precheckRes = await precheckBeneficiary('MTN', phones, true);
            const results = precheckRes.results || [];

            for (const item of items) {
                const normPhone = item.normalized_phone;
                const match = results.find(r => {
                    const p = r.phone || r.normalized || r.phoneNumber || r.msisdn || '';
                    return p === item.recipient_phone || p === normPhone || normalizeGhanaPhone(p) === normPhone;
                }) || null;

                const isKnown = match?.known === true;
                const isInvalid = match?.valid === false;

                if (isInvalid) {
                    // Invalid Phone Number -> Block
                    await pool.execute(
                        `UPDATE bulk_submission_items SET status = 'blocked', error_code = 'INVALID_PHONE', error_message = 'Recipient phone number is invalid', updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid`,
                        [item.id]
                    );
                    blockedCount++;
                } else if (!isKnown) {
                    // Unverified MTN Number -> Record in Pending MTN Approvals
                    console.log(`📱 [BULK WORKER] Item ${item.recipient_phone} is unverified MTN. Recording in Pending MTN Approvals.`);
                    await recordPendingBeneficiary({
                        phone: item.recipient_phone,
                        network: 'MTN',
                        bundleSize: sub.data_amount,
                        source: sub.source || 'Bulk API',
                        orderReference: `${sub.reference_code}-${item.item_index}`
                    }).catch(err => console.warn('Record pending beneficiary error:', err.message));

                    await pool.execute(
                        `UPDATE bulk_submission_items SET status = 'pending_mtn_approval', updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid`,
                        [item.id]
                    );
                    pendingMtnCount++;
                } else {
                    // Verified MTN Number -> Fulfill Order
                    const result = await fulfillSingleBulkItem(sub, item);
                    if (result.success) completedCount++;
                    else failedCount++;
                }
            }
        } else {
            // NON-MTN BATCH (Telecel, etc.): Fulfill directly
            for (const item of items) {
                const result = await fulfillSingleBulkItem(sub, item);
                if (result.success) completedCount++;
                else failedCount++;
            }
        }

        // Update bulk_submissions aggregate counts atomically
        await pool.execute(`
            UPDATE bulk_submissions
            SET queued_count = GREATEST(0, queued_count - ?),
                processing_count = GREATEST(0, processing_count - ? + ? + ? + ?),
                completed_count = completed_count + ?,
                failed_count = failed_count + ?,
                blocked_count = blocked_count + ?,
                pending_mtn_count = pending_mtn_count + ?,
                last_progress_at = CURRENT_TIMESTAMP
            WHERE id = ?::uuid
        `, [
            items.length,
            items.length,
            completedCount,
            failedCount,
            blockedCount + pendingMtnCount,
            completedCount,
            failedCount,
            blockedCount,
            pendingMtnCount,
            submissionId
        ]);

        console.log(`✅ [BULK WORKER] Chunk completed for ${sub.reference_code}: ${completedCount} completed, ${failedCount} failed, ${pendingMtnCount} pending MTN, ${blockedCount} blocked.`);

        // Reconcile batch status if no queued/processing items remain
        await reconcileBulkSubmission(submissionId);

    } catch (err) {
        console.error('❌ [BULK WORKER] Error processing bulk chunk:', err);
    } finally {
        isWorkerRunning = false;
        // Schedule next chunk execution immediately if queue is not empty
        setImmediate(() => {
            processNextBulkChunk().catch(() => {});
        });
    }
};

/**
 * Helper to fulfill a single item in a bulk chunk
 */
const fulfillSingleBulkItem = async (sub, item) => {
    try {
        const transactionId = uuidv4();

        // Call DataHouse API
        const fulfillment = await placeDataOrder({
            network: sub.network,
            dataAmount: sub.data_amount,
            recipientPhone: item.recipient_phone,
            transactionId: transactionId
        });

        const dhOrderId = fulfillment.providerPublicId || fulfillment.providerOrderId || fulfillment.orderId || null;
        const dhRefCode = fulfillment.providerReferenceCode || fulfillment.orderReference || null;
        const dhStatus = fulfillment.status || 'processing';

        if (fulfillment.success && (fulfillment.status === 'completed' || fulfillment.status === 'processing')) {
            const finalItemStatus = fulfillment.status === 'completed' ? 'completed' : 'processing';
            await pool.execute(
                `UPDATE bulk_submission_items 
                 SET status = ?, 
                     transaction_id = ?::uuid, 
                     datahouse_reference = ?,
                     datahouse_order_id = COALESCE(?, datahouse_order_id),
                     reference_code = COALESCE(?, reference_code),
                     current_datahouse_status = ?,
                     mapped_bytebeacon_status = ?,
                     last_synced_at = CURRENT_TIMESTAMP,
                     sync_status = 'synced',
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?::uuid`,
                [finalItemStatus, transactionId, dhOrderId, dhOrderId, dhRefCode, dhStatus, finalItemStatus, item.id]
            );
            return { success: true };
        } else {
            await pool.execute(
                `UPDATE bulk_submission_items 
                 SET status = 'failed', 
                     error_code = 'FULFILLMENT_FAILED', 
                     error_message = ?, 
                     current_datahouse_status = 'failed',
                     mapped_bytebeacon_status = 'failed',
                     last_synced_at = CURRENT_TIMESTAMP,
                     sync_status = 'synced',
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?::uuid`,
                [fulfillment.message || fulfillment.error || 'Provider order failed', item.id]
            );
            return { success: false };
        }
    } catch (err) {
        console.error(`❌ Fulfillment error for item ${item.recipient_phone}:`, err.message);
        await pool.execute(
            `UPDATE bulk_submission_items SET status = 'failed', error_code = 'EXCEPTIONAL_ERROR', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid`,
            [err.message, item.id]
        );
        return { success: false };
    }
};

/**
 * 3. Batch Reconciliation: Audit total Accounting Invariant & Finalize Batch Status
 */
const reconcileBulkSubmission = async (submissionId) => {
    try {
        const [subs] = await pool.execute('SELECT * FROM bulk_submissions WHERE id = ?::uuid', [submissionId]);
        if (subs.length === 0) return;
        const sub = subs[0];

        const [counts] = await pool.execute(`
            SELECT status, COUNT(*)::integer as cnt 
            FROM bulk_submission_items 
            WHERE submission_id = ?::uuid 
            GROUP BY status
        `, [submissionId]);

        const countMap = {};
        counts.forEach(c => { countMap[c.status] = parseInt(c.cnt, 10); });

        const total = sub.total_recipients;
        const queued = countMap['queued'] || 0;
        const processing = countMap['processing'] || 0;
        const completed = countMap['completed'] || 0;
        const failed = countMap['failed'] || 0;
        const blocked = countMap['blocked'] || 0;
        const pendingMtn = countMap['pending_mtn_approval'] || 0;

        const accountedFor = queued + processing + completed + failed + blocked + pendingMtn;
        const unresolved = Math.max(0, total - accountedFor);

        let finalStatus = 'processing';
        if (queued === 0 && processing === 0) {
            if (failed === 0 && unresolved === 0) {
                finalStatus = 'completed';
            } else if (completed > 0) {
                finalStatus = 'completed_with_errors';
            } else {
                finalStatus = 'failed';
            }
        }

        await pool.execute(`
            UPDATE bulk_submissions
            SET queued_count = ?,
                processing_count = ?,
                completed_count = ?,
                failed_count = ?,
                blocked_count = ?,
                pending_mtn_count = ?,
                unresolved_count = ?,
                status = ?,
                completed_at = CASE WHEN ? IN ('completed', 'completed_with_errors', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END,
                last_progress_at = CURRENT_TIMESTAMP
            WHERE id = ?::uuid
        `, [queued, processing, completed, failed, blocked, pendingMtn, unresolved, finalStatus, finalStatus, submissionId]);

        console.log(`📊 [RECONCILIATION] Batch ${sub.reference_code} reconciled: Status=${finalStatus}, Total=${total}, Completed=${completed}, Failed=${failed}, Pending MTN=${pendingMtn}, Blocked=${blocked}, Unresolved=${unresolved}`);

    } catch (err) {
        console.error('❌ Reconciliation error:', err.message);
    }
};

/**
 * 4. Watchdog Job: Requeue Stuck Jobs (> 5 min heartbeat timeout) & Process Dead-Letter Queue
 */
const runBulkWatchdog = async () => {
    try {
        const timeoutMs = config.WATCHDOG_HEARTBEAT_TIMEOUT_MS;
        const cutoffTime = new Date(Date.now() - timeoutMs);

        // Find stuck processing items
        const [stuckItems] = await pool.execute(`
            SELECT id, submission_id, attempt_count, max_attempts
            FROM bulk_submission_items
            WHERE status = 'processing' AND last_heartbeat_at < ?
            LIMIT 50
        `, [cutoffTime]);

        if (stuckItems.length > 0) {
            console.warn(`🐕 [WATCHDOG] Found ${stuckItems.length} stuck processing items. Requeueing / moving to DLQ...`);

            for (const item of stuckItems) {
                if (item.attempt_count < item.max_attempts) {
                    // Safe Requeue
                    await pool.execute(
                        `UPDATE bulk_submission_items SET status = 'queued', updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid`,
                        [item.id]
                    );
                    console.log(`🐕 [WATCHDOG] Requeued item ${item.id} (Attempt ${item.attempt_count}/${item.max_attempts})`);
                } else {
                    // Move to Dead-Letter Queue / Failed Status
                    await pool.execute(
                        `UPDATE bulk_submission_items SET status = 'failed', error_code = 'DEAD_LETTER_TIMEOUT', error_message = 'Job timed out after maximum heartbeat retries', updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid`,
                        [item.id]
                    );
                    console.error(`🛑 [WATCHDOG] Item ${item.id} reached max attempts. Moved to DLQ.`);
                }
            }
        }
    } catch (err) {
        console.error('❌ Bulk watchdog error:', err.message);
    }
};

module.exports = {
    submitBulkOrder,
    processNextBulkChunk,
    reconcileBulkSubmission,
    runBulkWatchdog
};
