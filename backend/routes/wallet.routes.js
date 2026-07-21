const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getBalance, fundWallet, getDeposits } = require('../controllers/wallet.controller');
const { createCreditRequest, getMyCreditRequests } = require('../controllers/walletRequest.controller');

// All routes require authentication
router.get('/balance', auth, getBalance);
router.post('/fund', auth, fundWallet);
router.get('/deposits', auth, getDeposits);

// Wallet credit requests (Agents)
router.post('/credit-requests', auth, createCreditRequest);
router.get('/credit-requests', auth, getMyCreditRequests);

module.exports = router;
