const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

/**
 * Security Middleware Configuration
 * Optimized for Cloudflare and General Production Security
 */

const { logActivity } = require('../utils/activityLogger');

// Helper to get client IP, prioritizing Cloudflare's connecting IP header
const getClientIp = (req) => {
    return req.headers['cf-connecting-ip'] ||
        (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : req.ip);
};

// Custom handler for rate limit blocks
const onLimitReached = (req, res, options) => {
    const ip = getClientIp(req);
    const userId = req.user ? req.user.id : null;
    logActivity(userId, 'SECURITY_BLOCK', `Rate limit reached on ${req.path}`, { ip, limit: options.max }, ip).catch(() => { });
    res.status(options.statusCode).send(options.message);
};

// Global rate limiter (General platform protection)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5000, // Increased for shared network IPs (e.g. mobile NAT)
    keyGenerator: getClientIp,
    message: {
        error: 'Too many requests.',
        message: 'Platform protection activated. Please try again in 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Auth limiter (Strict protection for Sensitive routes)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25, // 25 attempts per 15 mins (Login, Register, Reset)
    keyGenerator: getClientIp,
    message: {
        error: 'Too many attempts.',
        message: 'Security protection activated for authentication. Try again in 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Payment & Webhook limiter (Protection for transactional endpoints)
const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200, // Increased for stability
    keyGenerator: getClientIp,
    message: {
        error: 'Too many payment requests.',
        message: 'For your security, please wait a few minutes before trying again.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    globalLimiter,
    authLimiter,
    paymentLimiter,
    securityHeaders: helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "img-src": ["'self'", "data:", "https:", "blob:"],
                "connect-src": ["'self'", "https:", "wss:"],
            },
        },
        crossOriginEmbedderPolicy: false,
    })
};
