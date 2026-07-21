const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getAllBundles, getBundlesByNetwork, getBundleById } = require('../controllers/bundle.controller');

// Public routes (optional auth for agent pricing)
router.get('/', (req, res, next) => {
    // Try to authenticate but don't fail if not logged in
    const authHeader = req.headers.authorization;
    if (authHeader) {
        auth(req, res, next);
    } else {
        req.user = null;
        next();
    }
}, getAllBundles);

router.get('/network/:network', (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        auth(req, res, next);
    } else {
        req.user = null;
        next();
    }
}, getBundlesByNetwork);

router.get('/:id', getBundleById);

module.exports = router;
