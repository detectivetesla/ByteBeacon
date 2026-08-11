const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');

/**
 * Log a user activity to the database
 * @param {string} userId - The user's ID
 * @param {string} action - The action type (e.g., 'LOGIN', 'REGISTER', 'PURCHASE', 'WALLET_FUND')
 * @param {string} description - A human-readable description of the action
 * @param {object|null} metadata - Additional data about the action
 * @param {string|null} ipAddress - The user's IP address (optional)
 */
const logActivity = async (userId, action, description, metadata = null, ipAddress = null) => {
    try {
        if (!userId) {
            console.warn('⚠️ Activity log skipped: missing userId');
            return;
        }

        const id = uuidv4();
        let serializedMetadata = null;

        if (metadata && typeof metadata === 'object') {
            // Sanitize sensitive values before storing
            const sanitized = { ...metadata };
            for (const key of Object.keys(sanitized)) {
                const lowerKey = key.toLowerCase();
                if (
                    lowerKey.includes('password') ||
                    lowerKey.includes('secret') ||
                    lowerKey.includes('token') ||
                    lowerKey.includes('apikey') ||
                    lowerKey.includes('api_key')
                ) {
                    sanitized[key] = '[REDACTED]';
                }
            }
            serializedMetadata = JSON.stringify(sanitized);
        } else if (typeof metadata === 'string') {
            serializedMetadata = metadata;
        }

        await pool.execute(
            'INSERT INTO activity_logs (id, user_id, action, description, metadata, ip_address) VALUES (?::uuid, ?::uuid, ?, ?, ?::jsonb, ?)',
            [id, userId, action, description, serializedMetadata, ipAddress || null]
        );
    } catch (error) {
        // Log error but don't throw - activity logging should not break the main flow
        console.error('❌ Activity log error:', error.message);
    }
};

module.exports = { logActivity };
