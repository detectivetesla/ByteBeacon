const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { logActivity } = require('../utils/activityLogger');
const { sendAgentApplicationEmail } = require('../services/email.service');

// Send message to admin (user support/inquiry)
const sendMessageToAdmin = async (req, res) => {
    try {
        const { subject, body } = req.body;

        if (!subject || !body) {
            return res.status(400).json({ error: 'Subject and message body are required' });
        }

        // Get user's name for the message
        const [[userProfile]] = await pool.execute(
            'SELECT full_name, email FROM profiles WHERE id = ?::uuid',
            [req.user.id]
        );

        const userName = userProfile?.full_name || 'User';
        const userEmail = userProfile?.email || '';

        const messageId = uuidv4();
        await pool.execute(
            'INSERT INTO messages (id, sender_id, recipient_id, subject, body) VALUES (?, ?, ?, ?, ?)',
            [messageId, req.user.id, 'admin', subject, body]
        );

        // Emit Socket.IO event to admins for real-time notification
        const io = req.app.get('io');
        if (io) {
            io.emit('admin:newUserMessage', {
                id: messageId,
                senderId: req.user.id,
                senderName: userName,
                senderEmail: userEmail,
                subject,
                body,
                isRead: false,
                createdAt: new Date()
            });
        }

        res.status(201).json({
            message: 'Message sent to support successfully',
            id: messageId
        });
    } catch (error) {
        console.error('Send message to admin error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

// Get user profile
const getProfile = async (req, res) => {
    try {
        const [profiles] = await pool.execute(
            'SELECT id, full_name, email, phone, wallet_balance, created_at, updated_at FROM profiles WHERE id = ?::uuid',
            [req.user.id]
        );

        if (profiles.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const profile = profiles[0];

        res.json({
            id: profile.id,
            fullName: profile.full_name,
            email: profile.email,
            phone: profile.phone,
            walletBalance: parseFloat(profile.wallet_balance) || 0,
            role: req.user.role,
            createdAt: profile.created_at,
            updatedAt: profile.updated_at
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
};

// Update user profile
const updateProfile = async (req, res) => {
    try {
        const { fullName, email, phone } = req.body;

        if (!fullName || !phone) {
            return res.status(400).json({ error: 'Full name and phone are required' });
        }

        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // Update profiles table
            await connection.execute(
                'UPDATE profiles SET full_name = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                [fullName, email || req.user.email, phone, req.user.id]
            );

            // Update users table
            await connection.execute(
                'UPDATE users SET name = ?, email = ?, phone = ? WHERE uuid = ?::uuid',
                [fullName, email || req.user.email, phone, req.user.id]
            );

            await connection.commit();
            res.json({ message: 'Profile updated successfully' });
        } catch (error) {
            if (connection) await connection.rollback().catch(() => { });
            throw error;
        } finally {
            if (connection) connection.release();
        }

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

// Get user role
const getRole = async (req, res) => {
    try {
        const [roles] = await pool.execute(
            'SELECT role FROM user_roles WHERE user_id = ?::uuid',
            [req.user.id]
        );

        const role = roles.length > 0 ? roles[0].role : 'customer';
        res.json({ role });

    } catch (error) {
        console.error('Get role error:', error);
        res.status(500).json({ error: 'Failed to get role' });
    }
};

// Apply to become an agent or superagent
const applyForAgent = async (req, res) => {
    try {
        const { businessName, reason, experience, requestType = 'superagent' } = req.body;

        const isSuper = requestType === 'superagent';
        const AGENCY_FEE = isSuper ? 0.00 : 30.00;

        // Check for existing pending application of this type
        const [existing] = await pool.execute(
            'SELECT id, status FROM agent_requests WHERE user_id = ?::uuid AND request_type = ? ORDER BY created_at DESC LIMIT 1',
            [req.user.id, requestType]
        );

        if (existing.length > 0 && existing[0].status === 'processing') {
            return res.status(400).json({ error: `You already have a processing application for ${requestType} program` });
        }

        // Get wallet balance
        const [profiles] = await pool.execute(
            'SELECT wallet_balance FROM profiles WHERE id = ?::uuid',
            [req.user.id]
        );

        if (profiles.length === 0) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const currentBalance = parseFloat(profiles[0].wallet_balance);
        if (currentBalance < AGENCY_FEE) {
            return res.status(400).json({
                error: `Insufficient balance. Application fee is GHS ${AGENCY_FEE.toFixed(2)}. Your balance is GHS ${currentBalance.toFixed(2)}.`
            });
        }

        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            const requestId = uuidv4();
            const transactionId = uuidv4();

            if (AGENCY_FEE > 0) {
                // 1. Deduct fee from profile
                await connection.execute(
                    'UPDATE profiles SET wallet_balance = wallet_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                    [AGENCY_FEE, req.user.id]
                );

                // 2. Deduct fee from users table
                await connection.execute(
                    'UPDATE users SET wallet_balance = wallet_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE uuid = ?::uuid',
                    [AGENCY_FEE, req.user.id]
                );

                // 3. Create transaction record
                await connection.execute(
                    'INSERT INTO transactions (id, user_id, bundle_id, recipient_phone, amount_ghc, status) VALUES (?::uuid, ?::uuid, ?, ?, ?, ?)',
                    [transactionId, req.user.id, null, 'AGENCY_APPLICATION', AGENCY_FEE, 'completed']
                );
            }

            // 4. Create agent/superagent request
            await connection.execute(
                'INSERT INTO agent_requests (id, user_id, business_name, reason, experience, status, request_type) VALUES (?::uuid, ?::uuid, ?, ?, ?, ?, ?)',
                [requestId, req.user.id, businessName || null, reason, experience || null, 'processing', requestType]
            );

            await connection.commit();

            // Notify user of balance update via Socket.IO if a fee was charged
            const io = req.app.get('io');
            if (io) {
                if (AGENCY_FEE > 0) {
                    io.to(req.user.id).emit('balanceUpdate', {
                        newBalance: currentBalance - AGENCY_FEE,
                        message: `GHS ${AGENCY_FEE.toFixed(2)} deducted for agency application.`
                    });
                }

                // Notify admins of new application
                io.emit('admin:newAgentApplication', {
                    id: requestId,
                    userId: req.user.id,
                    userName: req.user.fullName || 'A user',
                    userEmail: req.user.email,
                    businessName: businessName || null,
                    feePaid: AGENCY_FEE,
                    requestType,
                    createdAt: new Date()
                });
            }

            res.status(201).json({
                message: `SuperAgent Application submitted successfully.`,
                id: requestId,
                transactionId
            });

            // Log activity (non-blocking)
            logActivity(req.user.id, 'SUPERAGENT_APPLICATION', `Applied for SuperAgent status`, { requestId, businessName, fee: AGENCY_FEE, requestType }, req.ip);

            // Send persistent notifications to all admins
            try {
                const [[profile2]] = await pool.execute(
                    'SELECT full_name, email FROM profiles WHERE id = ?::uuid',
                    [req.user.id]
                );
                const applicantName = profile2?.full_name || req.user.fullName || 'A user';
                const applicantEmail = profile2?.email || req.user.email || 'Unknown email';

                const [admins] = await pool.execute("SELECT uuid FROM users WHERE role = 'admin'");
                for (const admin of admins) {
                    // Notification about new superagent application
                    await pool.execute(
                        'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?::uuid, ?::uuid, ?, ?, ?)',
                        [uuidv4(), admin.uuid, 'New SuperAgent Application 📋', `${applicantName} (${applicantEmail}) has applied to become a SuperAgent. Review in the SuperAgents page.`, 'info']
                    );
                }
            } catch (adminNotifyErr) {
                console.error('Failed to send persistent admin notifications:', adminNotifyErr);
            }

            // Send email notification to admin (non-blocking)
            const [[profile]] = await pool.execute(
                'SELECT full_name, email, phone FROM profiles WHERE id = ?::uuid',
                [req.user.id]
            );
            sendAgentApplicationEmail({
                userName: profile?.full_name || req.user.fullName || 'Unknown User',
                userEmail: profile?.email || req.user.email || 'No email',
                userPhone: profile?.phone || 'Not provided',
                businessName: businessName || null,
                reason: reason,
                experience: experience || null,
                feePaid: AGENCY_FEE,
                applicationId: requestId
            }).catch(err => console.error('Failed to send agent application email:', err));

        } catch (error) {
            if (connection) await connection.rollback().catch(() => { });
            throw error;
        } finally {
            if (connection) connection.release();
        }
    } catch (error) {
        console.error('Apply for agent error:', error);
        res.status(500).json({ error: 'Failed to submit application' });
    }
};

// Get user's messages (both sent and received)
const getMyMessages = async (req, res) => {
    try {
        const [messages] = await pool.execute(`
            SELECT m.*, 
                   ps.full_name as sender_name, ps.email as sender_email,
                   pr.full_name as recipient_name, pr.email as recipient_email
            FROM messages m
            LEFT JOIN profiles ps ON (CASE WHEN m.sender_id ~ '^[0-9a-fA-F-]{36}$' THEN m.sender_id::uuid ELSE NULL END) = ps.id
            LEFT JOIN profiles pr ON (CASE WHEN m.recipient_id ~ '^[0-9a-fA-F-]{36}$' THEN m.recipient_id::uuid ELSE NULL END) = pr.id
            WHERE m.recipient_id = ? OR m.sender_id = ?
            ORDER BY m.created_at DESC
        `, [req.user.id, req.user.id]);

        const formatted = messages.map(m => {
            let senderName = m.sender_name;
            if (m.sender_id === 'system') {
                senderName = 'ByteBeacon System';
            } else if (m.sender_id === 'admin') {
                senderName = 'Support Team';
            } else if (m.sender_id === req.user.id) {
                senderName = 'Me';
            }

            let recipientName = m.recipient_name;
            if (m.recipient_id === 'admin') {
                recipientName = 'Support Team';
            } else if (m.recipient_id === req.user.id) {
                recipientName = 'Me';
            }

            return {
                id: m.id,
                senderId: m.sender_id,
                senderName: senderName || 'Unknown',
                recipientId: m.recipient_id,
                recipientName: recipientName || 'Unknown',
                subject: m.subject,
                body: m.body,
                isRead: Boolean(m.is_read),
                createdAt: m.created_at,
                isOutgoing: m.sender_id === req.user.id
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
};

// Mark message as read
const markMessageRead = async (req, res) => {
    try {
        const { id } = req.params;

        await pool.execute(
            'UPDATE messages SET is_read = TRUE WHERE id = ?::uuid AND recipient_id = ?',
            [id, req.user.id]
        );

        res.json({ message: 'Message marked as read' });
    } catch (error) {
        console.error('Mark message read error:', error);
        res.status(500).json({ error: 'Failed to mark message as read' });
    }
};

// Delete message
const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;

        await pool.execute(
            'DELETE FROM messages WHERE id = ?::uuid AND recipient_id = ?',
            [id, req.user.id]
        );

        res.json({ message: 'Message deleted' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
};

// Get user's notifications
const getMyNotifications = async (req, res) => {
    try {
        const [notifications] = await pool.execute(`
            SELECT * FROM notifications 
            WHERE user_id = ?::uuid OR user_id IS NULL
            ORDER BY created_at DESC
            LIMIT 50
        `, [req.user.id]);

        const formatted = notifications.map(n => ({
            id: n.id,
            title: n.title,
            message: n.message,
            type: n.type,
            isRead: Boolean(n.is_read),
            createdAt: n.created_at
        }));

        res.json(formatted);
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to get notifications' });
    }
};

// Get user's unread notifications count
const getUnreadNotificationsCount = async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT COUNT(*)::integer as count FROM notifications 
            WHERE (user_id = ?::uuid OR user_id IS NULL) AND is_read = FALSE
        `, [req.user.id]);
        res.json({ success: true, count: rows[0]?.count || 0 });
    } catch (error) {
        console.error('Get unread notifications count error:', error);
        res.status(500).json({ error: 'Failed to get unread notifications count' });
    }
};

// Mark notification as read
const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;

        await pool.execute(
            'UPDATE notifications SET is_read = TRUE WHERE id = ?::uuid AND (user_id = ?::uuid OR user_id IS NULL)',
            [id, req.user.id]
        );

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
};

// Mark all notifications as read
const markAllNotificationsRead = async (req, res) => {
    try {
        await pool.execute(
            'UPDATE notifications SET is_read = TRUE WHERE (user_id = ?::uuid OR user_id IS NULL)',
            [req.user.id]
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
};

// Delete notification
const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;

        await pool.execute(
            'DELETE FROM notifications WHERE id = ?::uuid AND (user_id = ?::uuid OR user_id IS NULL)',
            [id, req.user.id]
        );

        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
};

// Clear all notifications
const clearAllNotifications = async (req, res) => {
    try {
        await pool.execute(
            'DELETE FROM notifications WHERE (user_id = ?::uuid OR user_id IS NULL)',
            [req.user.id]
        );

        res.json({ message: 'All notifications cleared' });
    } catch (error) {
        console.error('Clear all notifications error:', error);
        res.status(500).json({ error: 'Failed to clear notifications' });
    }
};

// Get user's API keys
const getApiKeys = async (req, res) => {
    try {
        const [keys] = await pool.execute(
            'SELECT id, name, api_key, is_active, last_used, created_at FROM user_api_keys WHERE user_id = ?::uuid ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json({ success: true, apiKeys: keys });
    } catch (error) {
        console.error('Get API keys error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve API keys' });
    }
};

// Create a new named API key for the user
const createApiKey = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ success: false, error: 'API Key name is required.' });
        }
        
        // Prefix with 'dk_' as shown in the user's interface screenshot!
        const newKey = `dk_${require('crypto').randomBytes(24).toString('hex')}`;
        const keyId = uuidv4();

        await pool.execute(
            'INSERT INTO user_api_keys (id, user_id, name, api_key, is_active) VALUES (?::uuid, ?::uuid, ?, ?, TRUE)',
            [keyId, req.user.id, name.trim(), newKey]
        );

        logActivity(req.user.id, 'API_KEY_CREATED', `Created API key: ${name}`, {}, req.ip);

        res.json({
            success: true,
            message: 'API Key created successfully',
            apiKey: {
                id: keyId,
                name: name.trim(),
                api_key: newKey,
                is_active: true,
                created_at: new Date(),
                last_used: null
            }
        });
    } catch (error) {
        console.error('Create API key error:', error);
        res.status(500).json({ success: false, error: 'Failed to create API key' });
    }
};

// Revoke or permanently delete an API key
const deleteApiKey = async (req, res) => {
    try {
        const { id } = req.params;
        
        const [existing] = await pool.execute(
            'SELECT is_active FROM user_api_keys WHERE id = ?::uuid AND user_id = ?::uuid',
            [id, req.user.id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ success: false, error: 'API Key not found.' });
        }

        if (existing[0].is_active) {
            // First delete/revoke transitions key to is_active = FALSE (Revoked)
            await pool.execute(
                'UPDATE user_api_keys SET is_active = FALSE WHERE id = ?::uuid AND user_id = ?::uuid',
                [id, req.user.id]
            );
            logActivity(req.user.id, 'API_KEY_REVOKED', 'Revoked API key', { keyId: id }, req.ip);
            res.json({ success: true, message: 'API Key has been revoked successfully.' });
        } else {
            // Permanent delete if key is already revoked
            await pool.execute(
                'DELETE FROM user_api_keys WHERE id = ?::uuid AND user_id = ?::uuid',
                [id, req.user.id]
            );
            logActivity(req.user.id, 'API_KEY_DELETED', 'Permanently deleted API key', { keyId: id }, req.ip);
            res.json({ success: true, message: 'API Key has been deleted permanently.' });
        }
    } catch (error) {
        console.error('Delete API key error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete API key' });
    }
};

// Legacy single-key compatibility functions
const getApiKey = async (req, res) => {
    try {
        const [apiKeys] = await pool.execute(
            'SELECT api_key, created_at FROM user_api_keys WHERE user_id = ?::uuid AND is_active = TRUE ORDER BY created_at DESC LIMIT 1',
            [req.user.id]
        );

        if (apiKeys.length === 0) {
            const newKey = `dk_${require('crypto').randomBytes(24).toString('hex')}`;
            const keyId = uuidv4();
            await pool.execute(
                'INSERT INTO user_api_keys (id, user_id, name, api_key) VALUES (?::uuid, ?::uuid, ?, ?)',
                [keyId, req.user.id, 'Default API Key', newKey]
            );
            return res.json({ apiKey: newKey, createdAt: new Date() });
        }

        res.json({ apiKey: apiKeys[0].api_key, createdAt: apiKeys[0].created_at });
    } catch (error) {
        console.error('Get API key compatibility error:', error);
        res.status(500).json({ error: 'Failed to retrieve API key' });
    }
};

const regenerateApiKey = async (req, res) => {
    try {
        const newKey = `dk_${require('crypto').randomBytes(24).toString('hex')}`;
        const keyId = uuidv4();
        await pool.execute('UPDATE user_api_keys SET is_active = FALSE WHERE user_id = ?::uuid', [req.user.id]);
        await pool.execute(
            'INSERT INTO user_api_keys (id, user_id, name, api_key) VALUES (?::uuid, ?::uuid, ?, ?)',
            [keyId, req.user.id, 'Default API Key', newKey]
        );
        res.json({ message: 'API key regenerated successfully', apiKey: newKey, createdAt: new Date() });
    } catch (error) {
        console.error('Regenerate API key compatibility error:', error);
        res.status(500).json({ error: 'Failed to regenerate API key' });
    }
};

// Get application status
const getMyAgentApplication = async (req, res) => {
    try {
        const [applications] = await pool.execute(
            'SELECT * FROM agent_requests WHERE user_id = ?::uuid ORDER BY created_at DESC LIMIT 1',
            [req.user.id]
        );

        if (applications.length === 0) {
            return res.json({ hasApplication: false });
        }

        const app = applications[0];
        res.json({
            hasApplication: true,
            id: app.id,
            status: app.status,
            businessName: app.business_name,
            reason: app.reason,
            adminNotes: app.admin_notes,
            createdAt: app.created_at,
            updatedAt: app.updated_at
        });
    } catch (error) {
        console.error('Get application error:', error);
        res.status(500).json({ error: 'Failed to get application status' });
    }
};

// Get current user's activity logs
const getMyActivityLogs = async (req, res) => {
    try {
        const [logs] = await pool.execute(
            'SELECT id, action, description, metadata, ip_address, created_at FROM activity_logs WHERE user_id = ?::uuid ORDER BY created_at DESC LIMIT 30',
            [req.user.id]
        );
        res.json(logs);
    } catch (error) {
        console.error('Get my activity logs error:', error);
        res.status(500).json({ error: 'Failed to get activity logs' });
    }
};

// Get current user's partner profile
const getPartnerProfile = async (req, res) => {
    try {
        const [partners] = await pool.execute(
            'SELECT id, business_name, contact_name, email, phone, api_key, api_secret_encrypted, api_secret_iv, api_secret_auth_tag, test_api_key, test_api_secret_encrypted, test_api_secret_iv, test_api_secret_auth_tag, status, wallet_balance, credit_enabled, credit_limit, allow_unlimited_purchases, outstanding_balance, settlement_frequency, ip_whitelist, webhook_url, rate_limit_rpm, rate_limit_rph, rate_limit_rpd, created_at FROM partners WHERE user_id = ?::uuid',
            [req.user.id]
        );

        if (partners.length === 0) {
            return res.json({ hasPartnerProfile: false });
        }

        const partner = partners[0];
        let decryptedSecret = null;
        let decryptedTestSecret = null;
        try {
            const { decryptSecret } = require('../utils/encryption');
            if (partner.api_secret_encrypted) {
                decryptedSecret = decryptSecret(
                    partner.api_secret_encrypted,
                    partner.api_secret_iv,
                    partner.api_secret_auth_tag
                );
            }
            if (partner.test_api_secret_encrypted) {
                decryptedTestSecret = decryptSecret(
                    partner.test_api_secret_encrypted,
                    partner.test_api_secret_iv,
                    partner.test_api_secret_auth_tag
                );
            }
        } catch (decErr) {
            console.error('Failed to decrypt api_secret for user console:', decErr.message);
        }

        // Exclude internal crypt vars
        delete partner.api_secret_encrypted;
        delete partner.api_secret_iv;
        delete partner.api_secret_auth_tag;
        delete partner.test_api_secret_encrypted;
        delete partner.test_api_secret_iv;
        delete partner.test_api_secret_auth_tag;

        res.json({
            hasPartnerProfile: true,
            ...partner,
            api_secret: decryptedSecret,
            test_api_secret: decryptedTestSecret
        });
    } catch (error) {
        console.error('Get partner profile error:', error);
        res.status(500).json({ error: 'Failed to retrieve partner configuration.' });
    }
};

// Update current user's partner webhook and IP whitelist
const updatePartnerSettings = async (req, res) => {
    try {
        const { webhook_url, ip_whitelist } = req.body;

        // Fetch partner row
        const [partners] = await pool.execute(
            'SELECT id FROM partners WHERE user_id = ?::uuid',
            [req.user.id]
        );

        if (partners.length === 0) {
            return res.status(404).json({ error: 'Partner profile not found.' });
        }

        const partnerId = partners[0].id;

        // SSRF verification on webhookUrl
        if (webhook_url) {
            const { validateWebhookUrl } = require('../services/partnerWebhook.service');
            const isUrlSafe = await validateWebhookUrl(webhook_url);
            if (!isUrlSafe) {
                return res.status(400).json({ error: 'Invalid Webhook URL. It must be a public, valid HTTP/HTTPS URL and safe from SSRF.' });
            }
        }

        await pool.execute(
            'UPDATE partners SET webhook_url = ?, ip_whitelist = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
            [webhook_url || null, ip_whitelist || null, partnerId]
        );

        res.json({ success: true, message: 'Settings updated successfully.' });
    } catch (error) {
        console.error('Update partner settings error:', error);
        res.status(500).json({ error: 'Failed to update partner settings.' });
    }
};

// Get current user's partner logs
const getPartnerLogs = async (req, res) => {
    try {
        // Fetch partner row
        const [partners] = await pool.execute(
            'SELECT id FROM partners WHERE user_id = ?::uuid',
            [req.user.id]
        );

        if (partners.length === 0) {
            return res.status(404).json({ error: 'Partner profile not found.' });
        }

        const partnerId = partners[0].id;

        // Fetch logs
        const [webhooks] = await pool.execute(
            'SELECT id, transaction_id, webhook_url, attempt, status, response_code, created_at FROM partner_webhook_logs WHERE partner_id = ?::uuid ORDER BY created_at DESC LIMIT 50',
            [partnerId]
        );

        const [apiLogs] = await pool.execute(
            'SELECT id, ip_address, method, path, response_code, created_at FROM partner_api_logs WHERE partner_id = ?::uuid ORDER BY created_at DESC LIMIT 50',
            [partnerId]
        );

        const [ledger] = await pool.execute(
            'SELECT id, type, amount, description, reference, created_at FROM partner_ledger WHERE partner_id = ?::uuid ORDER BY created_at DESC LIMIT 50',
            [partnerId]
        );

        res.json({
            webhookLogs: webhooks,
            apiLogs: apiLogs,
            ledger: ledger
        });
    } catch (error) {
        console.error('Get partner logs error:', error);
        res.status(500).json({ error: 'Failed to retrieve logs.' });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    getRole,
    applyForAgent,
    getMyMessages,
    sendMessageToAdmin,
    markMessageRead,
    deleteMessage,
    getMyNotifications,
    getUnreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
    getMyAgentApplication,
    getApiKey,
    regenerateApiKey,
    getApiKeys,
    createApiKey,
    deleteApiKey,
    getMyActivityLogs,
    getPartnerProfile,
    updatePartnerSettings,
    getPartnerLogs
};
