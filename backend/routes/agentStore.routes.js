const express = require('express');
const router = express.Router();
const { auth, agentOrAdmin } = require('../middleware/auth');
const { withdrawalLimiter, storeCreationLimiter, paymentLimiter, exportLimiter } = require('../middleware/security');
const {
    createStore,
    getMyStore,
    updateStoreSettings,
    initializeActivationPayment,
    verifyActivationPayment,
    getStoreProducts,
    updateStoreProducts,
    deleteStoreProduct,
    addStoreProduct,
    getDashboardStats,
    getAgentOrders,
    exportAgentOrders,
    getAgentTransactions,
    exportAgentLedger,
    getAgentCustomers,
    getAgentAnalytics,
    requestWithdrawal,
    getWithdrawalHistory,
    exportAgentWithdrawals,
    getPublicStorefront,
    initializeCustomerPurchase,
    verifyCustomerPurchase,
    trackPublicOrder,
    getAgentBeneficiaries
} = require('../controllers/agentStore.controller');

// =============================================
// PUBLIC STOREFRONT ENDPOINTS (No Login Required)
// =============================================
router.get('/public/store/:slug', getPublicStorefront);
router.post('/public/store/:slug/buy/initialize', paymentLimiter, initializeCustomerPurchase);
router.post('/public/store/buy/verify', paymentLimiter, verifyCustomerPurchase);
router.get('/public/track/:orderId', trackPublicOrder);

// =============================================
// AUTHENTICATED AGENT STORE ENDPOINTS (User Login Required)
// =============================================
router.post('/create', auth, agentOrAdmin, storeCreationLimiter, createStore);
router.get('/my-store', auth, getMyStore);
router.put('/settings', auth, agentOrAdmin, updateStoreSettings);

// Activation Payment (GHS 100)
router.post('/activate/initialize', auth, paymentLimiter, initializeActivationPayment);
router.post('/activate/verify', auth, paymentLimiter, verifyActivationPayment);

// Products & Pricing
router.get('/products', auth, getStoreProducts);
router.post('/products/add', auth, agentOrAdmin, addStoreProduct);
router.post('/products/update', auth, agentOrAdmin, updateStoreProducts);
router.delete('/products/:bundleId', auth, agentOrAdmin, deleteStoreProduct);

// Dashboard & Stats
router.get('/dashboard', auth, getDashboardStats);
router.get('/orders/export', auth, exportLimiter, exportAgentOrders);
router.get('/orders', auth, getAgentOrders);
router.get('/transactions/export', auth, exportLimiter, exportAgentLedger);
router.get('/transactions', auth, getAgentTransactions);
router.get('/customers', auth, getAgentCustomers);
router.get('/analytics', auth, getAgentAnalytics);
router.get('/beneficiaries', auth, getAgentBeneficiaries);

// Financial Ledger & Withdrawals
router.post('/withdrawals', auth, agentOrAdmin, withdrawalLimiter, requestWithdrawal);
router.get('/withdrawals/export', auth, exportLimiter, exportAgentWithdrawals);
router.get('/withdrawals', auth, getWithdrawalHistory);

module.exports = router;
