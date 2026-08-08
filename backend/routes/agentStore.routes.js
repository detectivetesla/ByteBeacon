const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
    createStore,
    getMyStore,
    updateStoreSettings,
    initializeActivationPayment,
    verifyActivationPayment,
    getStoreProducts,
    updateStoreProducts,
    getDashboardStats,
    getAgentOrders,
    getAgentTransactions,
    getAgentCustomers,
    getAgentAnalytics,
    requestWithdrawal,
    getWithdrawalHistory,
    getPublicStorefront,
    initializeCustomerPurchase,
    verifyCustomerPurchase,
    trackPublicOrder
} = require('../controllers/agentStore.controller');

// =============================================
// PUBLIC STOREFRONT ENDPOINTS (No Login Required)
// =============================================
router.get('/public/store/:slug', getPublicStorefront);
router.post('/public/store/:slug/buy/initialize', initializeCustomerPurchase);
router.post('/public/store/buy/verify', verifyCustomerPurchase);
router.get('/public/track/:orderId', trackPublicOrder);

// =============================================
// AUTHENTICATED AGENT STORE ENDPOINTS (User Login Required)
// =============================================
router.post('/create', auth, createStore);
router.get('/my-store', auth, getMyStore);
router.put('/settings', auth, updateStoreSettings);

// Activation Payment (GHS 100)
router.post('/activate/initialize', auth, initializeActivationPayment);
router.post('/activate/verify', auth, verifyActivationPayment);

// Products & Pricing
router.get('/products', auth, getStoreProducts);
router.post('/products/update', auth, updateStoreProducts);

// Dashboard & Stats
router.get('/dashboard', auth, getDashboardStats);
router.get('/orders', auth, getAgentOrders);
router.get('/transactions', auth, getAgentTransactions);
router.get('/customers', auth, getAgentCustomers);
router.get('/analytics', auth, getAgentAnalytics);

// Financial Ledger & Withdrawals
router.post('/withdrawals', auth, requestWithdrawal);
router.get('/withdrawals', auth, getWithdrawalHistory);

module.exports = router;
