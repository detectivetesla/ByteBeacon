const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { logActivity } = require('../utils/activityLogger');

// Register new user
const register = async (req, res) => {
    let connection;
    try {
        const { email, password, fullName, phone } = req.body;

        // Validation
        if (!email || !password || !fullName || !phone) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        connection = await pool.getConnection();

        // Check if user exists (can stay outside transaction or inside)
        const [existing] = await connection.execute(
            'SELECT uuid FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Start transaction
        await connection.beginTransaction();

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();

        // Create user
        await connection.execute(
            'INSERT INTO users (uuid, name, email, phone, password_hash, email_verified) VALUES (?::uuid, ?, ?, ?, ?, ?)',
            [userId, fullName, email, phone, hashedPassword, true]
        );

        // Create profile (for compatibility/join logic)
        await connection.execute(
            'INSERT INTO profiles (id, full_name, email, phone, wallet_balance) VALUES (?::uuid, ?, ?, ?, ?)',
            [userId, fullName, email, phone, 0]
        );

        // Create default role in user_roles (explicit cast to enum type)
        await connection.execute(
            'INSERT INTO user_roles (id, user_id, role) VALUES (?::uuid, ?::uuid, ?::user_role)',
            [uuidv4(), userId, 'customer']
        );

        // Send automated welcome notification
        const welcomeNotificationId = uuidv4();
        await connection.execute(
            'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?::uuid, ?::uuid, ?, ?, ?)',
            [welcomeNotificationId, userId, 'Welcome to ByteBeacon! 🎉', `Hi ${fullName}, welcome to ByteBeacon! We're excited to have you on board. Start exploring our affordable data bundles and enjoy seamless transactions.`, 'success']
        );

        // Send welcome message
        const welcomeMessageId = uuidv4();
        await connection.execute(
            'INSERT INTO messages (id, sender_id, recipient_id, subject, body) VALUES (?::uuid, ?, ?::uuid, ?, ?)',
            [welcomeMessageId, 'system', userId, 'Welcome to ByteBeacon!', `Dear ${fullName},\n\nWelcome to ByteBeacon! 🎉\n\nWe're thrilled to have you as part of our growing community. Here's what you can do:\n\n• Browse affordable data bundles for MTN, Telecel, and AirtelTigo\n• Fund your wallet securely via Paystack\n• Enjoy instant data delivery\n\nIf you have any questions, feel free to reach out to our support team.\n\nHappy browsing!\n\n— The ByteBeacon Team`]
        );

        // Send agency invitation message (non-blocking notification of possibility)
        const agencyMessageId = uuidv4();
        await connection.execute(
            'INSERT INTO messages (id, sender_id, recipient_id, subject, body) VALUES (?::uuid, ?, ?::uuid, ?, ?)',
            [agencyMessageId, 'system', userId, 'Become a ByteBeacon Agent! 💼', `Dear ${fullName},\n\nDid you know you can earn more with ByteBeacon?\n\nBy becoming an Agent, you'll enjoy:\n\n• Discounted agent prices on all data bundles\n• Higher profit margins on resales\n• Priority support from our team\n\nApply today by visiting your dashboard and clicking "Apply for Agent".\n\nWe look forward to seeing you grow with us!\n\n— The ByteBeacon Team`]
        );

        await connection.commit();

        // Emit Socket.IO events for real-time delivery
        const io = req.app.get('io');
        if (io) {
            io.to(userId).emit('newNotification', {
                id: welcomeNotificationId,
                title: 'Welcome to ByteBeacon! 🎉',
                message: `Hi ${fullName}, welcome to ByteBeacon!`,
                type: 'success',
                isRead: false,
                createdAt: new Date()
            });
            io.to(userId).emit('newMessage', {
                id: welcomeMessageId,
                subject: 'Welcome to ByteBeacon!',
                senderName: 'ByteBeacon Team',
                body: `Dear ${fullName}, welcome to ByteBeacon! We're excited to have you as part of our growing community.`,
                isRead: false,
                createdAt: new Date()
            });
            io.to(userId).emit('newMessage', {
                id: agencyMessageId,
                subject: 'Become a ByteBeacon Agent! 💼',
                senderName: 'ByteBeacon Team',
                body: `Hi ${fullName}, earn more by becoming an Agent! Check your dashboard for details.`,
                isRead: false,
                createdAt: new Date()
            });
        }

        // Check if JWT_SECRET exists
        const secretCandidate = process.env.JWT_SECRET || process.env.VITE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
        if (!secretCandidate) {
            console.error('FATAL: JWT_SECRET / SUPABASE_JWT_SECRET is not set in environment variables');
            return res.status(500).json({
                error: 'Server configuration error',
                details: 'JWT_SECRET is missing. Please set it in your environment variables.'
            });
        }

        // Generate JWT token
        const secret = process.env.JWT_SECRET || process.env.VITE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
        const token = jwt.sign(
            { userId, email },
            secret,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                id: userId,
                email,
                fullName,
                role: 'customer'
            }
        });

        // Log activity (non-blocking)
        logActivity(userId, 'REGISTER', `New user registered: ${fullName}`, { email, phone }, req.ip);

        // Send persistent notifications to all admins about new user
        try {
            const [admins] = await pool.execute("SELECT uuid FROM users WHERE role = 'admin'");
            for (const admin of admins) {
                await pool.execute(
                    'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?::uuid, ?::uuid, ?, ?, ?)',
                    [uuidv4(), admin.uuid, 'New User Registered 👤', `${fullName} (${email}) has joined ByteBeacon.`, 'info']
                );
            }
        } catch (adminNotifyErr) {
            console.error('Failed to notify admins of new user:', adminNotifyErr);
        }

    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (rbErr) { }
        }
        console.error('Register error:', error);

        res.status(500).json({
            error: 'Registration failed',
            message: error.message
        });
    } finally {
        if (connection) connection.release();
    }
};

// Login user
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Get user from users table joined with user_roles
        console.log(`[LOGIN] Attempt for email: ${email}`);
        const [users] = await pool.execute(
            'SELECT u.uuid as id, u.email, u.password_hash, p.full_name, p.phone, p.wallet_balance, COALESCE(ur.role::text, u.role::text, \'customer\') as role FROM users u LEFT JOIN user_roles ur ON u.uuid = ur.user_id::uuid LEFT JOIN profiles p ON u.uuid = p.id::uuid WHERE LOWER(u.email) = LOWER(?)',
            [email.trim()]
        );

        if (users.length === 0) {
            console.log(`[LOGIN] User not found for: ${email}`);
            return res.status(401).json({
                error: 'Invalid credentials',
                debug: 'User not found in database. Please check your email spelling.',
                email: email
            });
        }

        const user = users[0];
        console.log(`[LOGIN] User found. Role: ${user.role}`);

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            console.log(`[LOGIN] Password mismatch for: ${email}`);
            return res.status(401).json({
                error: 'Invalid credentials',
                debug: 'Incorrect password. Please verify your password.',
                email: email
            });
        }

        const role = user.role || 'customer';

        // Admin Security: Check if admin email is whitelisted
        if (role === 'admin') {
            const secretAdminEmails = process.env.ALLOWED_ADMIN_EMAILS || process.env.VITE_ALLOWED_ADMIN_EMAILS;
            const allowedEmails = secretAdminEmails ?
                secretAdminEmails.split(',').map(e => e.trim().toLowerCase()) :
                [];

            if (allowedEmails.length > 0 && !allowedEmails.includes(user.email.toLowerCase())) {
                logActivity(user.id, 'SECURITY_ALERT', `Unauthorized admin login attempt: ${user.email}`, { role }, req.ip);
                return res.status(403).json({ error: 'This account is not authorized for admin access' });
            }
        }

        // Generate token
        const secret = process.env.JWT_SECRET || process.env.VITE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            secret,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                phone: user.phone,
                walletBalance: parseFloat(user.wallet_balance) || 0,
                role
            }
        });

        // Log activity (non-blocking)
        logActivity(user.id, 'LOGIN', `User logged in: ${user.email}`, { role }, req.ip);

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

// Get current user
const getMe = async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT p.id, p.email, p.full_name, p.phone, p.wallet_balance, p.created_at FROM profiles p WHERE p.id = ?::uuid',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];

        res.json({
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            phone: user.phone,
            walletBalance: parseFloat(user.wallet_balance) || 0,
            role: req.user.role,
            createdAt: user.created_at
        });

    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: 'Failed to get user data' });
    }
};

// Request password reset - sends email with reset link
const requestPasswordReset = async (req, res) => {
    try {
        const { email: rawEmail } = req.body;
        const email = rawEmail ? rawEmail.trim() : null;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Diagnostic logs (masked)
        console.log(`🔍 Password reset attempt for: "${email}"`);
        console.log(`📡 SMTP Config: Host=${process.env.SMTP_HOST || 'not set'}, User=${process.env.SMTP_USER ? '***' + process.env.SMTP_USER.slice(-4) : 'not set'}, Pass=${process.env.SMTP_PASS ? 'SET' : 'not set'}`);

        // Find user by email (case-insensitive) - Using TRIM and LOWER for robustness
        const [users] = await pool.execute(
            'SELECT u.uuid as id, p.full_name, u.email FROM users u LEFT JOIN profiles p ON u.uuid = p.id::uuid WHERE LOWER(TRIM(u.email)) = LOWER(?)',
            [email]
        );

        // Always return success to prevent email enumeration (In Production)
        // For Debugging: Providing more info if not in production or if requested
        if (users.length === 0) {
            console.log(`⚠️ User not found for password reset: ${email}`);
            return res.json({
                message: 'If the email exists, a reset link has been sent',
                debug: process.env.NODE_ENV !== 'production' ? 'User not found in database' : undefined
            });
        }

        const user = users[0];
        const crypto = require('crypto');

        // Generate secure token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenId = uuidv4();

        // Set expiration to 1 hour from now
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        console.log(`🛠️ Creating reset token for user ID: ${user.id}`);

        // Invalidate any existing tokens for this user
        await pool.execute(
            'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ?::uuid AND used = FALSE',
            [user.id]
        );

        // Store new token
        await pool.execute(
            'INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?::uuid, ?::uuid, ?, ?)',
            [tokenId, user.id, resetToken, expiresAt]
        );

        // Send email
        let emailErrorDetail = null;

        // Comprehensive check including VITE_ fallbacks
        const smtpHost = process.env.SMTP_HOST || process.env.VITE_SMTP_HOST || process.env.SMPT_HOST;
        const smtpUser = process.env.SMTP_USER || process.env.VITE_SMTP_USER || process.env.SMPT_USER;
        const smtpPass = process.env.SMTP_PASS || process.env.VITE_SMTP_PASS || process.env.SMPT_PASS;
        const smtpPort = process.env.SMTP_PORT || process.env.VITE_SMTP_PORT || process.env.SMPT_PORT;

        let envCheck = {
            host: !!smtpHost,
            user: !!smtpUser,
            pass: !!smtpPass,
            port: !!smtpPort,
            frontend: !!process.env.FRONTEND_URL
        };

        // For debugging: list ALL keys found on server to find naming mismatches
        const detectedKeys = Object.keys(process.env);

        try {
            if (!smtpUser || !smtpPass) {
                throw new Error(`Missing SMTP Credentials. Detected keys: [${detectedKeys.join(', ')}]`);
            }

            console.log(`📧 Dispatching reset email to ${email}`);
            const { sendPasswordResetEmail } = require('../services/email.service');
            await sendPasswordResetEmail(email, resetToken, user.full_name || 'User');
            console.log(`✅ Reset email successfully sent to ${email}`);
        } catch (emailError) {
            console.error('❌ CRITICAL EMAIL ERROR:', emailError);
            emailErrorDetail = emailError.message;
            // Additional check for common SMTP errors
            if (emailError.code === 'EAUTH') emailErrorDetail = 'Authentication failed. Please check app password.';
            if (emailError.code === 'ESOCKET') emailErrorDetail = 'Connection failed. Check SMTP host/port.';
        }

        // Find existing admin emails (for debugging access issues)
        let adminList = [];
        try {
            const [admins] = await pool.execute("SELECT email FROM users WHERE role = 'admin'");
            adminList = admins.map(a => a.email.split('@')[0].slice(0, 3) + '...@' + a.email.split('@')[1]);
        } catch (dbErr) {
            console.error('Failed to fetch admin list for debug:', dbErr);
        }

        res.json({
            message: 'If the email exists, a reset link has been sent',
            debug: emailErrorDetail ? `Email Error: ${emailErrorDetail}` : 'Process completed',
            envStatus: envCheck, // Show which ones the server sees
            adminAccounts: adminList, // Reveal which emails have the admin tag (obfuscated)
            success: emailErrorDetail ? false : true
        });

    } catch (error) {
        console.error('❌ Request password reset fatal error:', error);
        res.status(500).json({
            error: 'Failed to process reset request',
            details: error.message,
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
    }
};

// Verify reset token is valid
const verifyResetToken = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({ error: 'Token is required', valid: false });
        }

        const [tokens] = await pool.execute(
            'SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = ?',
            [token]
        );

        if (tokens.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired token', valid: false });
        }

        const tokenData = tokens[0];

        if (tokenData.used) {
            return res.status(400).json({ error: 'This reset link has already been used', valid: false });
        }

        if (new Date(tokenData.expires_at) < new Date()) {
            return res.status(400).json({ error: 'This reset link has expired', valid: false });
        }

        res.json({ valid: true, message: 'Token is valid' });

    } catch (error) {
        console.error('Verify reset token error:', error);
        res.status(500).json({ error: 'Failed to verify token', valid: false });
    }
};

// Execute password reset with new password
const executePasswordReset = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Find valid token
        const [tokens] = await pool.execute(
            'SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = ?',
            [token]
        );

        if (tokens.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset link' });
        }

        const tokenData = tokens[0];

        if (tokenData.used) {
            return res.status(400).json({ error: 'This reset link has already been used' });
        }

        if (new Date(tokenData.expires_at) < new Date()) {
            return res.status(400).json({ error: 'This reset link has expired' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user's password
        await pool.execute(
            'UPDATE users SET password_hash = ? WHERE uuid = ?::uuid',
            [hashedPassword, tokenData.user_id]
        );

        // Mark token as used
        await pool.execute(
            'UPDATE password_reset_tokens SET used = TRUE WHERE id = ?::uuid',
            [tokenData.id]
        );

        res.json({ message: 'Password reset successfully. You can now log in with your new password.' });

    } catch (error) {
        console.error('Execute password reset error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

// Logout (client-side token removal, but we can track if needed)
const logout = async (req, res) => {
    // JWT is stateless, so just return success
    // In production, you might want to blacklist the token
    res.json({ message: 'Logged out successfully' });
};

// Change password
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new passwords are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        // Get current password hash
        const [users] = await pool.execute(
            'SELECT password_hash FROM users WHERE uuid = ?::uuid',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, users[0].password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password and update
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.execute(
            'UPDATE users SET password_hash = ? WHERE uuid = ?::uuid',
            [hashedPassword, userId]
        );

        res.json({ message: 'Password changed successfully' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};

// Google OAuth login
const googleLogin = async (req, res) => {
    let connection;
    try {
        const { credential, clientId } = req.body;

        if (!credential) {
            return res.status(400).json({ error: 'Google credential is required' });
        }

        // Decode Google ID token (in production, use google-auth-library to verify)
        // For now, we'll decode the JWT payload
        const base64Url = credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));

        const { email, name, sub: googleId, picture } = payload;

        if (!email) {
            return res.status(400).json({ error: 'Email not found in Google token' });
        }

        connection = await pool.getConnection();

        // Check if user exists
        const [existing] = await connection.execute(
            'SELECT u.uuid as id, u.email, p.full_name, p.phone, p.wallet_balance, COALESCE(ur.role::text, u.role::text, \'customer\') as role FROM users u LEFT JOIN user_roles ur ON u.uuid = ur.user_id::uuid LEFT JOIN profiles p ON u.uuid = p.id::uuid WHERE u.email = ?',
            [email]
        );

        let userId;
        let fullName = name || email.split('@')[0];
        let role = 'customer';

        if (existing.length > 0) {
            // User exists, log them in
            userId = existing[0].id;
            fullName = existing[0].full_name || name;
            role = existing[0].role || 'customer';
        } else {
            // Start transaction for new user creation
            await connection.beginTransaction();
            try {
                // Create new user
                userId = uuidv4();
                const randomPassword = await bcrypt.hash(uuidv4(), 10); // Random password for Google users

                await connection.execute(
                    'INSERT INTO users (uuid, name, email, phone, password_hash, email_verified) VALUES (?::uuid, ?, ?, ?, ?, ?)',
                    [userId, fullName, email, '', randomPassword, true]
                );

                await connection.execute(
                    'INSERT INTO profiles (id, full_name, email, phone, wallet_balance) VALUES (?::uuid, ?, ?, ?, ?)',
                    [userId, fullName, email, '', 0]
                );

                await connection.execute(
                    'INSERT INTO user_roles (id, user_id, role) VALUES (?::uuid, ?::uuid, ?::user_role)',
                    [uuidv4(), userId, 'customer']
                );

                // Onboarding for new Google user
                const welcomeNotificationId = uuidv4();
                await connection.execute(
                    'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?::uuid, ?::uuid, ?, ?, ?)',
                    [welcomeNotificationId, userId, 'Welcome to ByteBeacon! 🎉', `Hi ${fullName}, welcome to ByteBeacon! We're excited to have you on board.`, 'success']
                );

                const welcomeMessageId = uuidv4();
                await connection.execute(
                    'INSERT INTO messages (id, sender_id, recipient_id, subject, body) VALUES (?::uuid, ?, ?::uuid, ?, ?)',
                    [welcomeMessageId, 'system', userId, 'Welcome to ByteBeacon!', `Dear ${fullName},\n\nWelcome to ByteBeacon! 🎉\n\nWe're thrilled to have you as part of our growing community.`]
                );

                const agencyMessageId = uuidv4();
                await connection.execute(
                    'INSERT INTO messages (id, sender_id, recipient_id, subject, body) VALUES (?::uuid, ?, ?::uuid, ?, ?)',
                    [agencyMessageId, 'system', userId, 'Become a ByteBeacon Agent! 💼', `Hi ${fullName},\n\nLearn how to earn more with ByteBeacon by becoming an Agent! Check your dashboard for details.`]
                );

                await connection.commit();

                // Emit Socket.IO events for the new user
                const io = req.app.get('io');
                if (io) {
                    io.to(userId).emit('newNotification', {
                        id: welcomeNotificationId,
                        title: 'Welcome to ByteBeacon! 🎉',
                        message: `Hi ${fullName}, welcome!`,
                        type: 'success',
                        isRead: false,
                        createdAt: new Date()
                    });
                }

                // Send persistent notifications to all admins about new user (Google)
                try {
                    const [admins] = await pool.execute("SELECT uuid FROM users WHERE role = 'admin'");
                    for (const admin of admins) {
                        await pool.execute(
                            'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?::uuid, ?::uuid, ?, ?, ?)',
                            [uuidv4(), admin.uuid, 'New User Registered (Google) 👤', `${fullName} (${email}) has joined ByteBeacon via Google.`, 'info']
                        );
                    }
                } catch (adminNotifyErr) {
                    console.error('Failed to notify admins of new Google user:', adminNotifyErr);
                }
            } catch (err) {
                await connection.rollback();
                throw err;
            }
        }

        // Admin Security: Check if admin email is whitelisted
        if (role === 'admin') {
            const secretAdminEmails = process.env.ALLOWED_ADMIN_EMAILS || process.env.VITE_ALLOWED_ADMIN_EMAILS;
            const allowedEmails = secretAdminEmails ?
                secretAdminEmails.split(',').map(e => e.trim().toLowerCase()) :
                [];

            if (allowedEmails.length > 0 && !allowedEmails.includes(email.toLowerCase())) {
                logActivity(userId, 'SECURITY_ALERT', `Unauthorized admin Google login attempt: ${email}`, { role }, req.ip);
                return res.status(403).json({ error: 'This account is not authorized for admin access' });
            }
        }

        // Generate JWT token
        const secret = process.env.JWT_SECRET || process.env.VITE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
        const token = jwt.sign(
            { userId, email },
            secret,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Google login successful',
            token,
            user: {
                id: userId,
                email,
                fullName,
                role
            }
        });

    } catch (error) {
        console.error('Google login error:', error);
        res.status(500).json({
            error: 'Google login failed',
            details: process.env.NODE_ENV === 'production' ? null : error.message,
            code: error.code
        });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    register,
    login,
    getMe,
    requestPasswordReset,
    verifyResetToken,
    executePasswordReset,
    logout,
    changePassword,
    googleLogin
};
