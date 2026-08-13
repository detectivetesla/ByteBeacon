const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

/**
 * Security Middleware Configuration
 * OWASP Compliant Security Headers & Endpoint Rate Limiters
 */

const { logActivity } = require('../utils/activityLogger');

// Helper to get client IP, prioritizing Cloudflare's connecting IP header
const getClientIp = (req) => {
    return req.headers['cf-connecting-ip'] ||
        (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.ip);
};

// Global rate limiter (General platform protection)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5000,
    keyGenerator: getClientIp,
    validate: false,
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
    validate: false,
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
    max: 200,
    keyGenerator: getClientIp,
    validate: false,
    message: {
        error: 'Too many payment requests.',
        message: 'For your security, please wait a few minutes before trying again.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Withdrawal limiter (Strict financial protection)
const withdrawalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // 10 withdrawal attempts per 15 minutes per IP
    keyGenerator: getClientIp,
    validate: false,
    message: {
        error: 'Too many withdrawal requests.',
        message: 'Financial security threshold reached. Please wait 15 minutes before requesting another withdrawal.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Store creation limiter (Prevents store spam)
const storeCreationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    keyGenerator: getClientIp,
    validate: false,
    message: {
        error: 'Store creation limit exceeded.',
        message: 'You have reached the maximum store creation attempts for this hour.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Export limiter (Protection against expensive query generation)
const exportLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 30, // 30 export requests per 5 minutes per user/IP
    keyGenerator: (req) => {
        return (req.user && req.user.id) ? `user_${req.user.id}` : getClientIp(req);
    },
    validate: false,
    message: {
        error: 'Too many export requests.',
        message: 'Export limit reached. Please wait a moment before requesting another export.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Enhanced Security Headers (Helmet)
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "https:", "blob:"],
            "connect-src": ["'self'", "https:", "wss:"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
});

module.exports = {
    globalLimiter,
    authLimiter,
    paymentLimiter,
    withdrawalLimiter,
    storeCreationLimiter,
    exportLimiter,
    securityHeaders
};
