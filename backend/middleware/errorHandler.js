const { logActivity } = require('../utils/activityLogger');

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Filter out common user-triggered errors from being logged as system failures
    const isUserError = err.status < 500 && err.status >= 400;

    if (!isUserError) {
        // Log critical system errors to activity log for visibility
        const userId = req.user ? req.user.id : null;
        logActivity(userId, 'SYSTEM_ERROR', `${err.name}: ${err.message}`, {
            path: req.path,
            method: req.method,
            code: err.code
        }, req.ip).catch(() => { });
    }

    // MySQL & PostgreSQL errors
    if (err.code === 'ER_DUP_ENTRY' || err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate entry exists (e.g. Email already registered)' });
    }

    if (err.code === 'ER_NO_REFERENCED_ROW' || err.code === '23503') {
        return res.status(400).json({ error: 'Referenced record not found (Foreign Key Constraint)' });
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message });
    }

    // Default error
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        code: err.code
    });
};

module.exports = errorHandler;
