const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const {
    createUser,
    getAllUsers,
    changeUserRole,
    getAllTransactions,
    getTransactionStats,
    updateTransactionStatus,
    createBundle,
    updateBundle,
    deleteBundle,
    getDashboardStats,
    updateUser,
    deleteUser,
    sendNotification,
    getAllNotifications,
    sendEmail,
    getAnalytics,
    sendMessage,
    getMessages,
    getAgentApplications,
    updateAgentApplication,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
    getAllBundles,
    deleteMessage,
    markMessageRead,
    getActivityLogs,
    getUserDetails,
    getAgentPricing,
    setAgentPricing,
    deleteAgentPricing,
    bulkSetAgentPricing,
    toggleUserStatus,
    getWalletCreditRequests,
    updateWalletCreditRequest,
    creditUserWallet,
    createPartner,
    getAllPartners,
    getPartnerDetails,
    updatePartner,
    adjustPartnerBalance,
    reprocessTransaction,
    massReprocessFailedTransactions,
    getAllAgentStores,
    updateAgentStoreReviewStatus,
    manualActivateAgentStore,
    getAllAgentWithdrawals,
    updateAgentWithdrawalStatus,
    getAgentPricingRules,
    updateAgentPricingRules
} = require('../controllers/admin.controller');
const { 
    updateMaintenanceStatus, 
    getSourcingSettings, 
    updateSourcingSettings,
    addSourcingProvider,
    updateSourcingProvider,
    deleteSourcingProvider,
    activateSourcingProvider,
    testSourcingProvider
} = require('../controllers/system.controller');

// All routes require admin authentication
router.use(auth);
router.use(adminOnly);

// Dashboard & System
router.get('/stats', getDashboardStats);
router.put('/maintenance', updateMaintenanceStatus);

// Sourcing API Settings
router.get('/sourcing-settings', getSourcingSettings);
router.put('/sourcing-settings', updateSourcingSettings);
router.post('/sourcing-providers', addSourcingProvider);
router.put('/sourcing-providers/:id', updateSourcingProvider);
router.delete('/sourcing-providers/:id', deleteSourcingProvider);
router.put('/sourcing-providers/:id/activate', activateSourcingProvider);
router.post('/sourcing-providers/:id/test', testSourcingProvider);

// Users
router.post('/users', createUser);
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetails);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.put('/users/:id/role', changeUserRole);
router.put('/users/:id/status', toggleUserStatus);
router.post('/users/:id/credit-wallet', creditUserWallet);

// Wallet Credit Requests
router.get('/wallet-credit-requests', getWalletCreditRequests);
router.put('/wallet-credit-requests/:id', updateWalletCreditRequest);

// Transactions
router.get('/transactions', getAllTransactions);
router.get('/transactions/stats', getTransactionStats);
router.put('/transactions/:id/status', updateTransactionStatus);
router.post('/transactions/reprocess-failed', massReprocessFailedTransactions);
router.post('/transactions/:id/reprocess', reprocessTransaction);

// Bundles
router.get('/bundles', getAllBundles);
router.post('/bundles', createBundle);
router.put('/bundles/:id', updateBundle);
router.delete('/bundles/:id', deleteBundle);

// Notifications & Emails
router.get('/analytics', getAnalytics);
router.post('/notifications', sendNotification);
router.get('/notifications', getAllNotifications);
router.put('/notifications/mark-all-read', markAllNotificationsRead);
router.put('/notifications/:id/read', markNotificationRead);
router.delete('/notifications', clearAllNotifications);
router.delete('/notifications/:id', deleteNotification);
router.post('/email', sendEmail);

// Messages
router.post('/messages', sendMessage);
router.get('/messages', getMessages);
router.put('/messages/:id/read', markMessageRead);
router.delete('/messages/:id', deleteMessage);

// Agent Applications
router.get('/agent-applications', getAgentApplications);
router.put('/agent-applications/:id', updateAgentApplication);

// Activity Logs
router.get('/activity-logs', getActivityLogs);

// Agent Pricing
router.get('/agents/:agentId/pricing', getAgentPricing);
router.post('/agents/:agentId/pricing', setAgentPricing);
router.put('/agents/:agentId/pricing/bulk', bulkSetAgentPricing);
router.delete('/agents/:agentId/pricing/:bundleId', deleteAgentPricing);

// Partners Management
router.post('/partners', createPartner);
router.get('/partners', getAllPartners);
router.get('/partners/:id', getPartnerDetails);
router.put('/partners/:id', updatePartner);
router.post('/partners/:id/adjust-balance', adjustPartnerBalance);

// Agent Store & Reseller Marketplace Management
router.get('/agent-stores', getAllAgentStores);
router.put('/agent-stores/:id/review', updateAgentStoreReviewStatus);
router.post('/agent-stores/:id/activate-manual', manualActivateAgentStore);
router.get('/agent-stores/withdrawals', getAllAgentWithdrawals);
router.put('/agent-stores/withdrawals/:id', updateAgentWithdrawalStatus);
router.get('/agent-stores/pricing-rules', getAgentPricingRules);
router.put('/agent-stores/pricing-rules', updateAgentPricingRules);

module.exports = router;
