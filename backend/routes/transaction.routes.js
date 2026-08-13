const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { exportLimiter } = require('../middleware/security');
const {
    purchaseBundle,
    getTransactions,
    getTransactionById,
    syncTransactionStatus,
    exportUserTransactions
} = require('../controllers/transaction.controller');

// All routes require authentication
router.post('/purchase', auth, purchaseBundle);
router.get('/export', auth, exportLimiter, exportUserTransactions);
router.get('/', auth, getTransactions);
router.get('/:id', auth, getTransactionById);
router.get('/:id/sync', auth, syncTransactionStatus);

module.exports = router;
