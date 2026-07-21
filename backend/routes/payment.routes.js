const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
    processPayment,
    verifyPayment,
    paystackWebhook,
    getPaymentStatus
} = require('../controllers/payment.controller');

// Process payment - initialize Paystack transaction
router.post('/process', auth, processPayment);

// Verify payment - verify with Paystack and process order
router.post('/verify', auth, verifyPayment);

// Get payment status by reference
router.get('/status/:reference', auth, getPaymentStatus);

// Paystack webhook - no auth required, uses signature verification
// Global express.json already populates req.rawBody via verify function
router.post('/webhook', paystackWebhook);

module.exports = router;
