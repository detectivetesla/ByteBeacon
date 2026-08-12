const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const partnerAuth = require('../middleware/partnerAuth');
const {
    createBulkSubmission,
    getBulkSubmissionStatus,
    getBulkSubmissionItems,
    retryBulkSubmission
} = require('../controllers/bulkOrder.controller');

// Optional auth (supports dashboard users, partner API keys, and public storefront)
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return auth(req, res, next);
    }
    const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'];
    if (apiKey) {
        return partnerAuth(req, res, next);
    }
    next();
};

router.post('/', optionalAuth, createBulkSubmission);
router.get('/:id', optionalAuth, getBulkSubmissionStatus);
router.get('/:id/items', optionalAuth, getBulkSubmissionItems);
router.post('/:id/retry', optionalAuth, retryBulkSubmission);

module.exports = router;
