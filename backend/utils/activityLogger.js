const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');

/**
 * Log a user activity to the database
 * @param {string} userId - The user's ID
 * @param {string} action - The action type (e.g., 'LOGIN', 'REGISTER', 'PURCHASE', 'WALLET_FUND')
 * @param {string} description - A human-readable description of the action
 * @param {object} metadata - Additional data about the action
 * @param {string} ipAddress - The user's IP address (optional)
 */
const logActivity = async (userId, action, description, metadata = null, ipAddress = null) => {
    try {
        const id = uuidv4();
        await pool.execute(
            'INSERT INTO activity_logs (id, user_id, action, description, metadata, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
            [id, userId, action, description, metadata, ipAddress]
        );
    } catch (error) {
        // Log error but don't throw - activity logging should not break the main flow
        console.error('Activity log error:', error);
    }
};

module.exports = { logActivity };
