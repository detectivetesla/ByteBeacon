const express = require('express');
const router = express.Router();
const { portal02Webhook } = require('../controllers/portal02.controller');

// Portal-02 webhook - no auth required (external callback)
router.post('/portal02', portal02Webhook);
router.get('/portal02', portal02Webhook); // Some providers use GET

module.exports = router;
