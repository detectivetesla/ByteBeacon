const express = require('express');
const router = express.Router();
const partnerAuth = require('../middleware/partnerAuth');
const {
    getPlans,
    purchaseData,
    getTransactionStatus,
    getTransactions,
    getWallet,
    getCredit
} = require('../controllers/partner.controller');

// Apply partner authentication to all routes below
router.use(partnerAuth);

router.get('/plans', getPlans);
router.post('/data/purchase', purchaseData);
router.get('/transactions/:id', getTransactionStatus);
router.get('/transactions', getTransactions);
router.get('/wallet', getWallet);
router.get('/credit', getCredit);

module.exports = router;
