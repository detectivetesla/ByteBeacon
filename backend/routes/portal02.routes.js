const express = require('express');
const router = express.Router();
const { portal02Webhook } = require('../controllers/portal02.controller');

// Portal-02 webhook endpoint (no auth required - external service)
// URL format: /api/portal02/webhook?transactionId=xxx
router.post('/webhook', portal02Webhook);
router.get('/webhook', portal02Webhook); // Support GET for compatibility

module.exports = router;
