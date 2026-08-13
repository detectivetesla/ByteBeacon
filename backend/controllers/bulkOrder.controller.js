const pool = require('../config/database');
const { submitBulkOrder, reconcileBulkSubmission } = require('../services/bulkOrder.service');
const { normalizePhone } = require('../integrations/datahouse');

/**
 * Controller for Bulk Order Ingestion, Status Tracking, & Items Pagination
 * DataHouse is the telecom authority for bulk order processing.
 */

// 1. Submit Bulk Order (POST /api/bulk-orders)
const createBulkSubmission = async (req, res) => {
    try {
        const {
            bundleId,
            network,
            dataAmount,
            recipients,
            idempotencyKey,
            source = 'API'
        } = req.body;

        const userId = req.user?.id || null;
        const partnerId = req.partner?.id || null;
        const agentId = req.user?.agent_id || null;

        const result = await submitBulkOrder({
            userId,
            partnerId,
            agentId,
            bundleId,
            network,
            dataAmount,
            recipients,
            idempotencyKey,
            source
        });

        return res.status(result.statusCode || 200).json(result);
    } catch (err) {
        console.error('Error in createBulkSubmission controller:', err);
        return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
    }
};

// 2. Get Bulk Submission Status & Progress (GET /api/bulk-orders/:id)
const getBulkSubmissionStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const [subs] = await pool.execute(
            `SELECT id, public_id, reference_code, network, data_amount, total_recipients, 
                    queued_count, processing_count, completed_count, failed_count, blocked_count, 
                    pending_mtn_count, unresolved_count, status, source, created_at, started_at, completed_at, last_progress_at
             FROM bulk_submissions 
             WHERE id::text = ? OR public_id = ? OR reference_code = ?`,
            [id, id, id]
        );

        if (subs.length === 0) {
            return res.status(404).json({ success: false, error: 'Bulk submission not found' });
        }

        const sub = subs[0];

        // Reconcile status with DataHouse if active
        if (['queued', 'processing'].includes(sub.status)) {
            await reconcileBulkSubmission(sub.id).catch(() => {});
        }

        const total = parseInt(sub.total_recipients, 10) || 0;
        const completed = parseInt(sub.completed_count, 10) || 0;
        const failed = parseInt(sub.failed_count, 10) || 0;
        const blocked = parseInt(sub.blocked_count, 10) || 0;
        const pendingMtn = parseInt(sub.pending_mtn_count, 10) || 0;

        const doneCount = completed + failed + blocked + pendingMtn;
        const progressPercent = total > 0 ? Math.min(100, Math.round((doneCount / total) * 100)) : 0;

        return res.json({
            success: true,
            data: {
                id: sub.id,
                publicId: sub.public_id,
                referenceCode: sub.reference_code,
                network: sub.network,
                dataAmount: sub.data_amount,
                status: sub.status,
                source: sub.source,
                totalRecipients: total,
                queued: parseInt(sub.queued_count, 10) || 0,
                processing: parseInt(sub.processing_count, 10) || 0,
                completed: completed,
                failed: failed,
                blocked: blocked,
                pendingMtn: pendingMtn,
                unresolved: parseInt(sub.unresolved_count, 10) || 0,
                progressPercent: progressPercent,
                createdAt: sub.created_at,
                startedAt: sub.started_at,
                completedAt: sub.completed_at,
                lastProgressAt: sub.last_progress_at
            }
        });
    } catch (err) {
        console.error('Error in getBulkSubmissionStatus:', err);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

// 3. Get Server-Side Paginated Items (GET /api/bulk-orders/:id/items)
const getBulkSubmissionItems = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 50, status = 'all', search = '' } = req.query;

        const p = Math.max(1, parseInt(page, 10));
        const l = Math.min(200, Math.max(1, parseInt(limit, 10)));
        const offset = (p - 1) * l;

        // Resolve submission UUID
        const [subs] = await pool.execute(
            `SELECT id FROM bulk_submissions WHERE id::text = ? OR public_id = ? OR reference_code = ?`,
            [id, id, id]
        );

        if (subs.length === 0) {
            return res.status(404).json({ success: false, error: 'Bulk submission not found' });
        }
        const submissionId = subs[0].id;

        let query = `
            SELECT id, item_index, recipient_phone, normalized_phone, network, bundle_size, 
                   status, transaction_id, datahouse_reference, attempt_count, error_code, error_message, created_at, updated_at
            FROM bulk_submission_items
            WHERE submission_id = ?::uuid
        `;
        const params = [submissionId];

        if (status && status !== 'all') {
            query += ' AND LOWER(status) = LOWER(?)';
            params.push(status);
        }

        if (search && search.trim() !== '') {
            const normSearch = normalizePhone(search.trim());
            query += ' AND (recipient_phone LIKE ? OR normalized_phone LIKE ?)';
            const term = `%${search.trim()}%`;
            params.push(term, `%${normSearch}%`);
        }

        // Count total matching rows
        const countQuery = `SELECT COUNT(*)::integer as count FROM (${query}) AS subquery`;
        const [countRows] = await pool.execute(countQuery, params);
        const totalItems = countRows[0]?.count || 0;

        query += ' ORDER BY item_index ASC LIMIT ? OFFSET ?';
        params.push(l, offset);

        const [rows] = await pool.execute(query, params);

        return res.json({
            success: true,
            data: rows,
            pagination: {
                page: p,
                limit: l,
                totalItems,
                totalPages: Math.ceil(totalItems / l)
            }
        });

    } catch (err) {
        console.error('Error in getBulkSubmissionItems:', err);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

// 4. Retry / Reconcile Bulk Submission (POST /api/bulk-orders/:id/retry)
const retryBulkSubmission = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await reconcileBulkSubmission(id);
        return res.json({ success: true, message: 'Bulk submission synchronized with DataHouse', data: result });
    } catch (err) {
        console.error('Error in retryBulkSubmission:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
};

module.exports = {
    createBulkSubmission,
    getBulkSubmissionStatus,
    getBulkSubmissionItems,
    retryBulkSubmission
};
