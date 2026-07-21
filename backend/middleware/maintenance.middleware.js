const pool = require('../config/database');

const maintenanceMiddleware = async (req, res, next) => {
    try {
        // Skip maintenance check for admin routes or if the user is an admin
        // (Admin routes start with /api/admin)
        if (req.path.startsWith('/api/admin') || req.path.startsWith('/admin') || (req.user && req.user.role === 'admin')) {
            return next();
        }

        // Also skip for the public maintenance check endpoint itself
        if (req.path === '/api/system/maintenance' || req.path === '/system/maintenance') {
            return next();
        }

        const [rows] = await pool.execute("SELECT setting_value FROM system_settings WHERE setting_key = 'maintenance_mode'");
        const isMaintenance = rows.length > 0 && rows[0].setting_value === 'true';

        if (isMaintenance) {
            return res.status(503).json({
                error: 'System is currently under maintenance. Please try again later.',
                maintenance: true
            });
        }

        next();
    } catch (error) {
        // If there's an error checking maintenance (e.g. table doesn't exist yet), let it pass
        // The first admin request will trigger table creation via controller
        console.error('Maintenance middleware error:', error);
        next();
    }
};

module.exports = maintenanceMiddleware;
