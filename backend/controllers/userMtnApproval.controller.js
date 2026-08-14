const pool = require('../config/database');
const { normalizePhone } = require('../integrations/datahouse');
const { sendExportResponse } = require('../utils/exportHelper');

/**
 * Get MTN beneficiary approval records filtered by authenticated user's role.
 * - Admin: All records (no ownership filter)
 * - Agent/SuperAgent: Records where user_id = req.user.id, or agent_id = req.user.id, or agent_store_id belongs to user
 * - Customer: Records where user_id = req.user.id only
 */
exports.getMyMtnApprovals = async (req, res) => {
    try {
        const { status = 'all', timeframe = 'all', search = '', page = 1, limit = 30 } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;

        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const parsedLimit = Math.max(1, parseInt(limit, 10) || 30);
        const offset = (parsedPage - 1) * parsedLimit;

        let whereClause = ' WHERE 1=1';
        const params = [];

        // Role-based ownership filter
        if (userRole === 'admin') {
            // Admin sees everything — no filter
        } else if (userRole === 'agent' || userRole === 'superagent') {
            // Agent/SuperAgent: own submissions + agent orders + store orders
            whereClause += ` AND (
                a.user_id = ?::uuid
                OR a.agent_id = ?::uuid
                OR EXISTS (
                    SELECT 1 FROM mtn_beneficiary_approval_orders o
                    WHERE o.approval_id = a.id AND (o.user_id = ?::uuid OR o.agent_id = ?::uuid)
                )
                OR EXISTS (
                    SELECT 1 FROM mtn_beneficiary_approval_orders o
                    JOIN agent_stores s ON o.agent_store_id = s.id
                    WHERE o.approval_id = a.id AND s.user_id = ?::uuid
                )
            )`;
            params.push(userId, userId, userId, userId, userId);
        } else {
            // Customer: only their own submissions
            whereClause += ` AND (
                a.user_id = ?::uuid
                OR EXISTS (
                    SELECT 1 FROM mtn_beneficiary_approval_orders o
                    WHERE o.approval_id = a.id AND o.user_id = ?::uuid
                )
            )`;
            params.push(userId, userId);
        }

        // Status filter
        if (status && status !== 'all') {
            whereClause += ' AND LOWER(a.status) = LOWER(?)';
            params.push(status);
        }

        // Timeframe filter
        if (timeframe && timeframe !== 'all') {
            if (timeframe === 'today') {
                whereClause += ' AND a.first_detected_at >= CURRENT_DATE';
            } else {
                let intervalDays = 0;
                if (timeframe === '7d') intervalDays = 7;
                else if (timeframe === '30d') intervalDays = 30;
                else if (timeframe === '90d') intervalDays = 90;
                else if (timeframe === '1y') intervalDays = 365;

                if (intervalDays > 0) {
                    whereClause += ` AND a.first_detected_at >= NOW() - INTERVAL '${intervalDays} days'`;
                }
            }
        }

        // Search filter
        if (search && search.trim() !== '') {
            const normSearch = normalizePhone(search.trim());
            whereClause += ' AND (a.msisdn LIKE ? OR a.display_phone LIKE ? OR a.msisdn LIKE ?)';
            const term = `%${search.trim()}%`;
            params.push(term, term, `%${normSearch}%`);
        }

        // 1. Get total count for pagination metadata
        const countQuery = `SELECT COUNT(*)::integer as total FROM mtn_beneficiary_approvals a${whereClause}`;
        const [[countRow]] = await pool.execute(countQuery, params);
        const total = countRow?.total || 0;
        const totalPages = Math.max(1, Math.ceil(total / parsedLimit));

        // 2. Fetch paginated records with deterministic sort
        const dataQuery = `
            SELECT a.id, a.msisdn, a.display_phone, a.network, a.status, a.occurrences, a.bundle_sizes, a.sources,
                   a.primary_source, a.datahouse_reference, a.datahouse_status, a.datahouse_sync_status,
                   a.first_detected_at, a.last_detected_at, a.submitted_at, a.approved_at, a.rejected_at, a.resolved_at
            FROM mtn_beneficiary_approvals a
            ${whereClause}
            ORDER BY a.last_detected_at DESC, a.id DESC
            LIMIT ? OFFSET ?
        `;
        const dataParams = [...params, parsedLimit, offset];
        const [rows] = await pool.execute(dataQuery, dataParams);

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
                primarySource: r.primary_source || (sources.length > 0 ? sources[0] : 'DASHBOARD'),
                datahouseReference: r.datahouse_reference || null,
                datahouseStatus: r.datahouse_status || r.status || 'pending',
                datahouseSyncStatus: r.datahouse_sync_status || 'pending',
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
        console.error('Error in getMyMtnApprovals:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch MTN beneficiary approvals' });
    }
};

/**
 * Get count of unresolved pending MTN approvals for the authenticated user (for sidebar badge)
 * Distinguishes between total pending and unread/new pending since user last visited.
 */
exports.getMyPendingCount = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        let baseWhere = ` WHERE a.status IN ('pending', 'submitted')`;
        const params = [];

        if (userRole === 'admin') {
            // No filter
        } else if (userRole === 'agent' || userRole === 'superagent') {
            baseWhere += ` AND (
                a.user_id = ?::uuid OR a.agent_id = ?::uuid
                OR EXISTS (SELECT 1 FROM mtn_beneficiary_approval_orders o WHERE o.approval_id = a.id AND (o.user_id = ?::uuid OR o.agent_id = ?::uuid))
                OR EXISTS (SELECT 1 FROM mtn_beneficiary_approval_orders o JOIN agent_stores s ON o.agent_store_id = s.id WHERE o.approval_id = a.id AND s.user_id = ?::uuid)
            )`;
            params.push(userId, userId, userId, userId, userId);
        } else {
            baseWhere += ` AND (
                a.user_id = ?::uuid
                OR EXISTS (SELECT 1 FROM mtn_beneficiary_approval_orders o WHERE o.approval_id = a.id AND o.user_id = ?::uuid)
            )`;
            params.push(userId, userId);
        }

        const [[totalRow]] = await pool.execute(`SELECT COUNT(*)::integer as total FROM mtn_beneficiary_approvals a ${baseWhere}`, params);
        const total = totalRow?.total || 0;

        let unreadCount = total;
        const [profileRows] = await pool.execute(`SELECT last_seen_mtn_at FROM profiles WHERE id = ?::uuid`, [userId]).catch(() => [[]]);
        const lastSeenAt = profileRows[0]?.last_seen_mtn_at;

        if (lastSeenAt) {
            const [[unreadRow]] = await pool.execute(
                `SELECT COUNT(*)::integer as unread FROM mtn_beneficiary_approvals a ${baseWhere} AND (a.last_detected_at > ?::timestamptz OR a.first_detected_at > ?::timestamptz)`,
                [...params, lastSeenAt, lastSeenAt]
            );
            unreadCount = unreadRow?.unread || 0;
        }

        res.json({
            success: true,
            count: unreadCount,
            total,
            totalPending: total,
            unreadCount
        });
    } catch (error) {
        console.error('Error getting user pending count:', error);
        res.status(500).json({ success: false, error: 'Failed to get count' });
    }
};

/**
 * Mark all current pending MTN approvals as seen for the authenticated user
 */
exports.markMySeen = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (userId) {
            await pool.execute(
                `UPDATE profiles SET last_seen_mtn_at = NOW() WHERE id = ?::uuid`,
                [userId]
            );
        }
        res.json({ success: true, message: 'Marked pending MTN approvals as seen' });
    } catch (error) {
        console.error('Error marking MTN approvals as seen:', error);
        res.status(500).json({ success: false, error: 'Failed to mark as seen' });
    }
};

/**
 * Get linked orders for a specific beneficiary approval record (with ownership check)
 */
exports.getMyApprovalOrders = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        // For non-admin users, verify ownership before returning linked orders
        if (userRole !== 'admin') {
            let ownerCheck = `SELECT 1 FROM mtn_beneficiary_approvals a WHERE a.id = ?::uuid AND (
                a.user_id = ?::uuid
                OR EXISTS (SELECT 1 FROM mtn_beneficiary_approval_orders o WHERE o.approval_id = a.id AND (o.user_id = ?::uuid OR o.agent_id = ?::uuid))
            )`;
            const checkParams = [id, userId, userId, userId];

            if (userRole === 'agent' || userRole === 'superagent') {
                ownerCheck = `SELECT 1 FROM mtn_beneficiary_approvals a WHERE a.id = ?::uuid AND (
                    a.user_id = ?::uuid OR a.agent_id = ?::uuid
                    OR EXISTS (SELECT 1 FROM mtn_beneficiary_approval_orders o WHERE o.approval_id = a.id AND (o.user_id = ?::uuid OR o.agent_id = ?::uuid))
                    OR EXISTS (SELECT 1 FROM mtn_beneficiary_approval_orders o JOIN agent_stores s ON o.agent_store_id = s.id WHERE o.approval_id = a.id AND s.user_id = ?::uuid)
                )`;
                checkParams.length = 0;
                checkParams.push(id, userId, userId, userId, userId, userId);
            }

            const [check] = await pool.execute(ownerCheck, checkParams);
            if (check.length === 0) {
                return res.status(404).json({ success: false, error: 'Approval record not found' });
            }
        }

        const [orders] = await pool.execute(
            `SELECT id, approval_id, order_id, order_reference, bundle_size, source, created_at
             FROM mtn_beneficiary_approval_orders
             WHERE approval_id = ?::uuid
             ORDER BY created_at DESC`,
            [id]
        );
        res.json({ success: true, orders });
    } catch (error) {
        console.error('Error fetching user beneficiary approval orders:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch linked orders' });
    }
};

/**
 * Export user/agent pending MTN approvals matching active filters
 */
exports.exportMyMtnApprovals = async (req, res) => {
    try {
        const { status = 'all', timeframe = 'all', search = '', format = 'csv' } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;

        const safeFormat = ['csv', 'excel', 'xlsx', 'json'].includes(String(format).toLowerCase())
            ? String(format).toLowerCase()
            : 'csv';

        let whereClause = ' WHERE 1=1';
        const params = [];

        // Role-based ownership filter
        if (userRole === 'admin') {
            // Admin sees everything
        } else if (userRole === 'agent' || userRole === 'superagent') {
            whereClause += ` AND (
                a.user_id = ?::uuid
                OR a.agent_id = ?::uuid
                OR EXISTS (
                    SELECT 1 FROM mtn_beneficiary_approval_orders o
                    WHERE o.approval_id = a.id AND (o.user_id = ?::uuid OR o.agent_id = ?::uuid)
                )
                OR EXISTS (
                    SELECT 1 FROM mtn_beneficiary_approval_orders o
                    JOIN agent_stores s ON o.agent_store_id = s.id
                    WHERE o.approval_id = a.id AND s.user_id = ?::uuid
                )
            )`;
            params.push(userId, userId, userId, userId, userId);
        } else {
            whereClause += ` AND (
                a.user_id = ?::uuid
                OR EXISTS (
                    SELECT 1 FROM mtn_beneficiary_approval_orders o
                    WHERE o.approval_id = a.id AND o.user_id = ?::uuid
                )
            )`;
            params.push(userId, userId);
        }

        // Status filter
        if (status && status !== 'all') {
            whereClause += ' AND LOWER(a.status) = LOWER(?)';
            params.push(status);
        }

        // Timeframe filter
        if (timeframe && timeframe !== 'all') {
            if (timeframe === 'today') {
                whereClause += ' AND a.first_detected_at >= CURRENT_DATE';
            } else {
                let intervalDays = 0;
                if (timeframe === '7d') intervalDays = 7;
                else if (timeframe === '30d') intervalDays = 30;
                else if (timeframe === '90d') intervalDays = 90;
                else if (timeframe === '1y') intervalDays = 365;

                if (intervalDays > 0) {
                    whereClause += ` AND a.first_detected_at >= NOW() - (${intervalDays} * INTERVAL '1 day')`;
                }
            }
        }

        // Search filter
        if (search && search.trim() !== '') {
            const trimmed = search.trim();
            const normSearch = normalizePhone(trimmed);
            whereClause += ' AND (a.msisdn LIKE ? OR a.display_phone LIKE ? OR a.msisdn LIKE ?)';
            const term = `%${trimmed}%`;
            params.push(term, term, `%${normSearch}%`);
        }

        const dataQuery = `
            SELECT a.id, a.msisdn, a.display_phone, a.network, a.status, a.occurrences, a.bundle_sizes, a.sources,
                   a.primary_source, a.datahouse_reference, a.datahouse_status, a.datahouse_sync_status,
                   a.first_detected_at, a.last_detected_at, a.submitted_at, a.approved_at, a.rejected_at, a.resolved_at
            FROM mtn_beneficiary_approvals a
            ${whereClause}
            ORDER BY a.last_detected_at DESC, a.id DESC
        `;

        const [rows] = await pool.execute(dataQuery, params);

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
                label: 'Source',
                transform: (r) => {
                    if (!r.sources) return r.primary_source || 'DASHBOARD';
                    try {
                        const parsed = typeof r.sources === 'string' ? JSON.parse(r.sources) : r.sources;
                        return Array.isArray(parsed) ? parsed.join('; ') : String(parsed);
                    } catch {
                        return String(r.sources);
                    }
                }
            },
            { key: 'occurrences', label: 'Attempts' },
            { key: 'status', label: 'Status' },
            {
                key: 'first_detected_at',
                label: 'Submitted Date',
                transform: (r) => r.first_detected_at ? new Date(r.first_detected_at).toISOString() : ''
            },
            {
                key: 'last_detected_at',
                label: 'Last Update',
                transform: (r) => r.last_detected_at ? new Date(r.last_detected_at).toISOString() : ''
            }
        ];

        return sendExportResponse(res, {
            data: rows,
            columns,
            filename: 'bytebeacon_my_pending_mtn',
            format: safeFormat,
            sheetName: 'My Pending MTN Numbers'
        });

    } catch (error) {
        console.error('Error in exportMyMtnApprovals:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to export MTN approvals. The server encountered an unexpected error.'
        });
    }
};
