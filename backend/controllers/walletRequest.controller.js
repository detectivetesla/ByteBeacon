const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { logActivity } = require('../utils/activityLogger');

// Create a new wallet credit request
exports.createCreditRequest = async (req, res) => {
    try {
        const { amount, agentNotes } = req.body;
        const userId = req.user.id;

        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ error: 'Valid credit amount is required' });
        }

        const requestId = uuidv4();
        await pool.execute(
            `INSERT INTO wallet_credit_requests (id, user_id, amount, status, agent_notes, created_at, updated_at)
             VALUES (?::uuid, ?::uuid, ?, 'pending', ?, NOW(), NOW())`,
            [requestId, userId, parseFloat(amount), agentNotes || null]
        );

        // Fetch user info for logging
        const [user] = await pool.execute('SELECT full_name FROM profiles WHERE id = ?::uuid', [userId]);
        const userName = user.length > 0 ? user[0].full_name : 'Agent';

        // Log activity (non-blocking)
        logActivity(userId, 'WALLET_FUND', `Requested wallet credit of GHS ${parseFloat(amount).toFixed(2)}`, { requestId, amount }, req.ip);

        res.status(201).json({
            success: true,
            message: 'Credit request submitted successfully',
            data: {
                id: requestId,
                amount: parseFloat(amount),
                status: 'pending',
                agentNotes
            }
        });
    } catch (error) {
        console.error('Create credit request error:', error);
        res.status(500).json({ error: 'Failed to submit credit request', details: error.message });
    }
};

// Get authenticated agent's own credit requests
exports.getMyCreditRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const [requests] = await pool.execute(
            `SELECT id, amount, status, admin_notes, agent_notes, created_at, updated_at
             FROM wallet_credit_requests
             WHERE user_id = ?::uuid
             ORDER BY created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            data: requests.map(r => ({
                id: r.id,
                amount: parseFloat(r.amount),
                status: r.status,
                adminNotes: r.admin_notes,
                agentNotes: r.agent_notes,
                createdAt: r.created_at,
                updatedAt: r.updated_at
            }))
        });
    } catch (error) {
        console.error('Get my credit requests error:', error);
        res.status(500).json({ error: 'Failed to fetch credit requests' });
    }
};
