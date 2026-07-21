const express = require('express');
const router = express.Router();
const { datahouseWebhook } = require('../controllers/datahouse.controller');

// Datahouse webhook endpoint (no auth required - external service)
// URL format: /api/datahouse/webhook
router.post('/webhook', datahouseWebhook);
router.get('/webhook', datahouseWebhook); // Support GET for compatibility

module.exports = router;
