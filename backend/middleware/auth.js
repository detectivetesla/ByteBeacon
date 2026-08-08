const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Verify JWT token
const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET || process.env.VITE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET;

        const decoded = jwt.verify(token, secret);

        // Check if user is active and get role
        // COALESCE handling for is_active to prevent crash if column missing during migration
        const [users] = await pool.execute(
            "SELECT u.uuid as id, u.email, COALESCE(u.is_active, TRUE) as is_active, COALESCE(ur.role::text, u.role::text, 'customer') as role FROM users u LEFT JOIN user_roles ur ON u.uuid = ur.user_id::uuid WHERE u.uuid = ?",
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        if (users[0].is_active === false) {
            return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
        }

        req.user = {
            id: users[0].id,
            email: users[0].email,
            role: users[0].role
        };

        next();
    } catch (error) {
        console.error('❌ Authentication middleware error:', error.message);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        return res.status(500).json({ error: 'Authentication failed', details: error.message });
    }
};

// Admin only middleware
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Agent, SuperAgent or admin middleware
const agentOrAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'agent' && req.user.role !== 'superagent') {
        return res.status(403).json({ error: 'Agent or admin access required' });
    }
    next();
};

// Helper to just get user from token without sending response (useful for optional auth)
const getUserFromToken = async (req) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }

        const token = authHeader.split(' ')[1];
        if (!token) return null;

        const secret = process.env.JWT_SECRET || process.env.VITE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
        const decoded = jwt.verify(token, secret);

        const [users] = await pool.execute(
            "SELECT u.uuid as id, u.email, COALESCE(ur.role::text, u.role::text, 'customer') as role FROM users u LEFT JOIN user_roles ur ON u.uuid = ur.user_id::uuid WHERE u.uuid = ?",
            [decoded.userId]
        );

        if (users.length === 0) return null;

        return {
            id: users[0].id,
            email: users[0].email,
            role: users[0].role
        };
    } catch (error) {
        return null;
    }
};

module.exports = { auth, adminOnly, agentOrAdmin, getUserFromToken };
