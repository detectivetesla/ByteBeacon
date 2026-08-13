const express = require('express');
const router = express.Router();
const { datahouseWebhook } = require('../controllers/datahouse.controller');

// DataHouse Webhook endpoint: /api/webhooks/datahouse
router.post('/datahouse', datahouseWebhook);
router.get('/datahouse', datahouseWebhook);

module.exports = router;
