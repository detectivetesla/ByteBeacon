const pool = require('../config/database');
const { syncBeneficiaryApprovals } = require('../services/mtnApproval.service');
const { normalizeGhanaPhone } = require('../utils/datahouse');

/**
 * Get paginated list of MTN beneficiary approval records with filters
 */
exports.getMtnApprovals = async (req, res) => {
    try {
        const { status = 'all', timeframe = 'all', search = '', limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT id, msisdn, display_phone, network, status, occurrences, bundle_sizes, sources,
                   first_detected_at, last_detected_at, submitted_at, approved_at, rejected_at, resolved_at
            FROM mtn_beneficiary_approvals
            WHERE 1=1
        `;
        const params = [];

        // Status Filter
        if (status && status !== 'all') {
            query += ' AND LOWER(status) = LOWER(?)';
            params.push(status);
        }

        // Timeframe Filter
        if (timeframe && timeframe !== 'all') {
            const now = new Date();
            let intervalDays = 0;

            if (timeframe === 'today') {
                query += ' AND first_detected_at >= CURRENT_DATE';
            } else {
                if (timeframe === '7d') intervalDays = 7;
                else if (timeframe === '30d') intervalDays = 30;
                else if (timeframe === '90d') intervalDays = 90;
                else if (timeframe === '1y') intervalDays = 365;

                if (intervalDays > 0) {
                    query += ` AND first_detected_at >= NOW() - INTERVAL '${intervalDays} days'`;
                }
            }
        }

        // Search Filter (Number or normalized MSISDN)
        if (search && search.trim() !== '') {
            const normSearch = normalizeGhanaPhone(search.trim());
            query += ' AND (msisdn LIKE ? OR display_phone LIKE ? OR msisdn LIKE ?)';
            const term = `%${search.trim()}%`;
            params.push(term, term, `%${normSearch}%`);
        }

        query += ' ORDER BY last_detected_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.execute(query, params);

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
            count: formatted.length
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
            message: `Sync completed. ${result.updated} beneficiary records updated.`,
            updated: result.updated
        });
    } catch (error) {
        console.error('Error syncing MTN approvals:', error);
        res.status(500).json({ success: false, error: 'Sync failed' });
    }
};

/**
 * Export filtered MTN beneficiary numbers in CSV format
 */
exports.exportMtnApprovals = async (req, res) => {
    try {
        const { status = 'pending', timeframe = 'all', search = '' } = req.query;

        let query = `
            SELECT display_phone, msisdn, bundle_sizes, sources, occurrences, status, first_detected_at, last_detected_at
            FROM mtn_beneficiary_approvals
            WHERE 1=1
        `;
        const params = [];

        if (status && status !== 'all') {
            query += ' AND LOWER(status) = LOWER(?)';
            params.push(status);
        }

        if (timeframe && timeframe !== 'all') {
            let intervalDays = 0;
            if (timeframe === 'today') {
                query += ' AND first_detected_at >= CURRENT_DATE';
            } else {
                if (timeframe === '7d') intervalDays = 7;
                else if (timeframe === '30d') intervalDays = 30;
                else if (timeframe === '90d') intervalDays = 90;
                else if (timeframe === '1y') intervalDays = 365;

                if (intervalDays > 0) {
                    query += ` AND first_detected_at >= NOW() - INTERVAL '${intervalDays} days'`;
                }
            }
        }

        if (search && search.trim() !== '') {
            const normSearch = normalizeGhanaPhone(search.trim());
            query += ' AND (msisdn LIKE ? OR display_phone LIKE ? OR msisdn LIKE ?)';
            const term = `%${search.trim()}%`;
            params.push(term, term, `%${normSearch}%`);
        }

        query += ' ORDER BY last_detected_at DESC';

        const [rows] = await pool.execute(query, params);

        // Generate CSV content
        let csv = 'Phone Number,MSISDN,Bundle Sizes,Sources,Occurrences,Status,First Detected,Last Detected\n';
        rows.forEach(r => {
            let bSizes = '';
            try { bSizes = (typeof r.bundle_sizes === 'string' ? JSON.parse(r.bundle_sizes) : r.bundle_sizes).join('; '); } catch (e) {}

            let src = '';
            try { src = (typeof r.sources === 'string' ? JSON.parse(r.sources) : r.sources).join('; '); } catch (e) {}

            csv += `"${r.display_phone}","${r.msisdn}","${bSizes}","${src}",${r.occurrences},"${r.status}","${r.first_detected_at}","${r.last_detected_at}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="MTN_Pending_Beneficiaries_${Date.now()}.csv"`);
        res.status(200).send(csv);

    } catch (error) {
        console.error('Error exporting MTN approvals:', error);
        res.status(500).json({ success: false, error: 'Export failed' });
    }
};
