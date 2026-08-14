const pool = require('../config/database');

/**
 * High-Performance In-Memory Maintenance Mode Cache
 * Prevents hammering PostgreSQL on high-frequency API traffic.
 */
let cachedMaintenance = {
    enabled: false,
    title: "We're upgrading ByteBeacon",
    message: "A little maintenance is underway. You can still explore ByteBeacon, but account access and transactions are temporarily paused.",
    estimatedEnd: null,
    lastFetched: 0
};

const CACHE_TTL_MS = 5000; // 5 seconds cache window

async function getCachedMaintenanceState() {
    const now = Date.now();
    if (now - cachedMaintenance.lastFetched < CACHE_TTL_MS) {
        return cachedMaintenance;
    }

    try {
        const [rows] = await pool.execute(
            "SELECT setting_value FROM system_settings WHERE setting_key = 'maintenance_mode' LIMIT 1"
        );

        if (rows.length > 0) {
            const raw = rows[0].setting_value;
            let enabled = false;
            let title = "We're upgrading ByteBeacon";
            let message = "A little maintenance is underway. You can still explore ByteBeacon, but account access and transactions are temporarily paused.";
            let estimatedEnd = null;

            if (raw === 'true') {
                enabled = true;
            } else if (raw === 'false') {
                enabled = false;
            } else {
                try {
                    const parsed = JSON.parse(raw);
                    enabled = Boolean(parsed.enabled ?? parsed.isActive);
                    if (parsed.title) title = parsed.title;
                    if (parsed.message) message = parsed.message;
                    if (parsed.estimatedEnd) estimatedEnd = parsed.estimatedEnd;
                } catch {
                    enabled = raw === 'true';
                }
            }

            cachedMaintenance = {
                enabled,
                title,
                message,
                estimatedEnd,
                lastFetched: now
            };
        }
    } catch (err) {
        // Keep previous cached state on db error
    }

    return cachedMaintenance;
}

function invalidateMaintenanceCache() {
    cachedMaintenance.lastFetched = 0;
}

/**
 * Intelligent Maintenance Mode Access-Control Guard
 *
 * Rules:
 * 1. Public catalog, auth entrypoints, webhooks, and health checks are ALWAYS accessible.
 * 2. Authenticated administrators ALWAYS bypass maintenance.
 * 3. Protected transactional operations (purchases, wallet, orders) return 503 with friendly retryable envelope.
 */
const maintenanceMiddleware = async (req, res, next) => {
    try {
        // 1. Always allow Admin routes and verified Admins
        if (
            req.path.startsWith('/api/admin') || 
            req.path.startsWith('/admin') || 
            (req.user && req.user.role === 'admin')
        ) {
            return next();
        }

        // 2. Always allow Public Information, Auth, Webhook, and Health endpoints
        const publicPrefixes = [
            '/api/system/maintenance',
            '/system/maintenance',
            '/api/system/health',
            '/api/health',
            '/health',
            '/api/bundles',        // Public data bundle catalog browsing
            '/api/auth/login',      // Allow credential submission (handled with maintenance feedback or admin login)
            '/api/auth/register',
            '/api/auth/forgot-password',
            '/api/auth/reset-password',
            '/api/auth/verify',
            '/api/webhooks'         // Sourcing provider webhooks must NEVER be blocked
        ];

        const isPublicRoute = publicPrefixes.some(prefix => req.path.startsWith(prefix));
        if (isPublicRoute) {
            return next();
        }

        // 3. Check cached maintenance state
        const state = await getCachedMaintenanceState();
        if (state.enabled) {
            // Return machine-readable, friendly 503 Service Unavailable
            res.setHeader('Retry-After', '3600');
            return res.status(503).json({
                success: false,
                error: {
                    code: 'MAINTENANCE_MODE',
                    message: 'ByteBeacon is temporarily unavailable while maintenance is in progress.',
                    retryable: true,
                    details: {
                        title: state.title,
                        message: state.message,
                        estimatedReturn: state.estimatedEnd || 'Shortly'
                    }
                }
            });
        }

        next();
    } catch (error) {
        console.error('Maintenance middleware error:', error);
        next();
    }
};

module.exports = maintenanceMiddleware;
module.exports.getCachedMaintenanceState = getCachedMaintenanceState;
module.exports.invalidateMaintenanceCache = invalidateMaintenanceCache;
