const pool = require('../config/database');
const { syncBeneficiaryApprovals } = require('../services/mtnApproval.service');
const { normalizeGhanaPhone } = require('../utils/datahouse');
const { sendExportResponse } = require('../utils/exportHelper');

/**
 * Get paginated list of MTN beneficiary approval records with filters
 */
exports.getMtnApprovals = async (req, res) => {
    try {
        const { status = 'all', timeframe = 'all', search = '', page = 1, limit = 30 } = req.query;

        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const parsedLimit = Math.max(1, parseInt(limit, 10) || 30);
        const offset = (parsedPage - 1) * parsedLimit;

        let whereClause = ' WHERE 1=1';
        const params = [];

        // Status Filter
        if (status && status !== 'all') {
            whereClause += ' AND LOWER(status) = LOWER(?)';
            params.push(status);
        }

        // Timeframe Filter
        if (timeframe && timeframe !== 'all') {
            let intervalDays = 0;

            if (timeframe === 'today') {
                whereClause += ' AND first_detected_at >= CURRENT_DATE';
            } else {
                if (timeframe === '7d') intervalDays = 7;
                else if (timeframe === '30d') intervalDays = 30;
                else if (timeframe === '90d') intervalDays = 90;
                else if (timeframe === '1y') intervalDays = 365;

                if (intervalDays > 0) {
                    whereClause += ` AND first_detected_at >= NOW() - INTERVAL '${intervalDays} days'`;
                }
            }
        }

        // Search Filter (Number or normalized MSISDN)
        if (search && search.trim() !== '') {
            const normSearch = normalizeGhanaPhone(search.trim());
            whereClause += ' AND (msisdn LIKE ? OR display_phone LIKE ? OR msisdn LIKE ? OR datahouse_reference LIKE ?)';
            const term = `%${search.trim()}%`;
            params.push(term, term, `%${normSearch}%`, term);
        }

        // 1. Get total count for pagination metadata
        const countQuery = `SELECT COUNT(*)::integer as total FROM mtn_beneficiary_approvals${whereClause}`;
        const [[countRow]] = await pool.execute(countQuery, params);
        const total = countRow?.total || 0;
        const totalPages = Math.max(1, Math.ceil(total / parsedLimit));

        // 2. Fetch paginated records with deterministic sort
        const dataQuery = `
            SELECT id, msisdn, display_phone, network, status, occurrences, bundle_sizes, sources,
                   datahouse_reference, datahouse_status, datahouse_sync_status, datahouse_last_sync_at, datahouse_sync_error,
                   first_detected_at, last_detected_at, submitted_at, approved_at, rejected_at, resolved_at
            FROM mtn_beneficiary_approvals
            ${whereClause}
            ORDER BY last_detected_at DESC, id DESC
            LIMIT ? OFFSET ?
        `;
        const dataParams = [...params, parsedLimit, offset];
        const [rows] = await pool.execute(dataQuery, dataParams);

        // Parse JSON fields
        const formatted = rows.map(r => {
            let bundleSizes = [];
            try { bundleSizes = typeof r.bundle_sizes === 'string' ? JSON.parse(r.bundle_sizes) : (r.bundle_sizes || []); } catch (e) {}

            let sources = [];
            try { sources = typeof r.sources === 'string' ? JSON.parse(r.sources) : (r.sources || []); } catch (e) {}

            return {
                id: r.id,
                msisdn: r.msisdn,
                displayPhone: r.display_phone,
                network: r.network,
                status: r.status,
                occurrences: r.occurrences,
                bundleSizes,
                sources,
                datahouseReference: r.datahouse_reference || null,
                datahouseStatus: r.datahouse_status || r.status || 'pending',
                datahouseSyncStatus: r.datahouse_sync_status || (r.datahouse_reference ? 'synced' : 'pending'),
                datahouseLastSyncAt: r.datahouse_last_sync_at || null,
                datahouseSyncError: r.datahouse_sync_error || null,
                firstDetectedAt: r.first_detected_at,
                lastDetectedAt: r.last_detected_at,
                submittedAt: r.submitted_at,
                approvedAt: r.approved_at,
                rejectedAt: r.rejected_at,
                resolvedAt: r.resolved_at
            };
        });

        res.json({
            success: true,
            data: formatted,
            meta: {
                page: parsedPage,
                limit: parsedLimit,
                total,
                totalPages,
                hasNextPage: parsedPage < totalPages,
                hasPreviousPage: parsedPage > 1
            }
        });
    } catch (error) {
        console.error('Error in getMtnApprovals:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch MTN beneficiary approvals' });
    }
};

/**
 * Get count of unresolved pending MTN approvals for sidebar badge
 */
exports.getPendingCount = async (req, res) => {
    try {
        const [[row]] = await pool.execute(
            `SELECT COUNT(*)::integer as count FROM mtn_beneficiary_approvals WHERE status IN ('pending', 'submitted')`
        );
        res.json({ success: true, count: row?.count || 0 });
    } catch (error) {
        console.error('Error getting pending count:', error);
        res.status(500).json({ success: false, error: 'Failed to get count' });
    }
};

/**
 * Get linked orders for a specific beneficiary approval record
 */
exports.getMtnApprovalOrders = async (req, res) => {
    try {
        const { id } = req.params;
        const [orders] = await pool.execute(
            `SELECT id, approval_id, order_id, order_reference, bundle_size, source, created_at
             FROM mtn_beneficiary_approval_orders
             WHERE approval_id = ?::uuid
             ORDER BY created_at DESC`,
            [id]
        );
        res.json({ success: true, orders });
    } catch (error) {
        console.error('Error fetching beneficiary approval orders:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch linked orders' });
    }
};

/**
 * Trigger manual status sync with DataHouse API
 */
exports.syncMtnApprovals = async (req, res) => {
    try {
        const result = await syncBeneficiaryApprovals();
        res.json({
            success: true,
            message: `Sync completed. ${result.updated || 0} updated, ${result.retried || 0} re-registered.`,
            updated: result.updated || 0,
            retried: result.retried || 0
        });
    } catch (error) {
        console.error('Error syncing MTN approvals:', error);
        res.status(500).json({ success: false, error: 'Sync failed' });
    }
};

/**
 * Export filtered MTN beneficiary numbers in CSV, Excel, or JSON format
 */
exports.exportMtnApprovals = async (req, res) => {
    try {
        const { status = 'all', timeframe = 'all', search = '', format = 'csv' } = req.query;

        // Allowlist format validation
        const safeFormat = ['csv', 'excel', 'xlsx', 'json'].includes(String(format).toLowerCase())
            ? String(format).toLowerCase()
            : 'csv';

        let query = `
            SELECT 
                display_phone, 
                msisdn, 
                network, 
                bundle_sizes, 
                sources, 
                primary_source, 
                occurrences, 
                status, 
                datahouse_reference, 
                datahouse_sync_status, 
                datahouse_last_sync_at, 
                datahouse_sync_error, 
                first_detected_at, 
                last_detected_at
            FROM mtn_beneficiary_approvals
            WHERE 1=1
        `;
        const params = [];

        // Status filter
        if (status && status !== 'all') {
            query += ' AND LOWER(status) = LOWER(?)';
            params.push(status);
        }

        // Timeframe filter
        if (timeframe && timeframe !== 'all') {
            if (timeframe === 'today') {
                query += ' AND first_detected_at >= CURRENT_DATE';
            } else {
                let intervalDays = 0;
                if (timeframe === '7d') intervalDays = 7;
                else if (timeframe === '30d') intervalDays = 30;
                else if (timeframe === '90d') intervalDays = 90;
                else if (timeframe === '1y') intervalDays = 365;

                if (intervalDays > 0) {
                    query += ` AND first_detected_at >= NOW() - (${intervalDays} * INTERVAL '1 day')`;
                }
            }
        }

        // Search filter
        if (search && search.trim() !== '') {
            const trimmed = search.trim();
            const normSearch = normalizeGhanaPhone(trimmed);
            query += ' AND (msisdn LIKE ? OR display_phone LIKE ? OR msisdn LIKE ? OR datahouse_reference LIKE ?)';
            const term = `%${trimmed}%`;
            params.push(term, term, `%${normSearch}%`, term);
        }

        query += ' ORDER BY last_detected_at DESC';

        const [rows] = await pool.execute(query, params);

        const columns = [
            { key: 'display_phone', label: 'Phone Number' },
            { key: 'msisdn', label: 'MSISDN' },
            { key: 'network', label: 'Network' },
            {
                key: 'bundle_sizes',
                label: 'Bundle Sizes',
                transform: (r) => {
                    if (!r.bundle_sizes) return '';
                    try {
                        const parsed = typeof r.bundle_sizes === 'string' ? JSON.parse(r.bundle_sizes) : r.bundle_sizes;
                        return Array.isArray(parsed) ? parsed.join('; ') : String(parsed);
                    } catch {
                        return String(r.bundle_sizes);
                    }
                }
            },
            {
                key: 'sources',
                label: 'Sources',
                transform: (r) => {
                    if (!r.sources) return r.primary_source || '';
                    try {
                        const parsed = typeof r.sources === 'string' ? JSON.parse(r.sources) : r.sources;
                        return Array.isArray(parsed) ? parsed.join('; ') : String(parsed);
                    } catch {
                        return String(r.sources);
                    }
                }
            },
            { key: 'primary_source', label: 'Primary Source' },
            { key: 'occurrences', label: 'Occurrences' },
            { key: 'status', label: 'Status' },
            { key: 'datahouse_reference', label: 'DataHouse Reference' },
            { key: 'datahouse_sync_status', label: 'DH Sync Status' },
            {
                key: 'datahouse_last_sync_at',
                label: 'Last Sync Date',
                transform: (r) => r.datahouse_last_sync_at ? new Date(r.datahouse_last_sync_at).toISOString() : ''
            },
            { key: 'datahouse_sync_error', label: 'Sync Error' },
            {
                key: 'first_detected_at',
                label: 'First Detected',
                transform: (r) => r.first_detected_at ? new Date(r.first_detected_at).toISOString() : ''
            },
            {
                key: 'last_detected_at',
                label: 'Last Detected',
                transform: (r) => r.last_detected_at ? new Date(r.last_detected_at).toISOString() : ''
            }
        ];

        return sendExportResponse(res, {
            data: rows,
            columns,
            filename: 'bytebeacon_admin_mtn_approvals',
            format: safeFormat,
            sheetName: 'MTN Pending Approvals'
        });

    } catch (error) {
        console.error('Error exporting MTN approvals:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to export MTN approvals. The server encountered an unexpected error.'
        });
    }
};
