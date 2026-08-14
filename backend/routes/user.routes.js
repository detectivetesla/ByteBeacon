const express = require('express');
const router = express.Router();
const { auth, superAgentOrAdmin } = require('../middleware/auth');
const { exportLimiter } = require('../middleware/security');
const {
    getProfile,
    updateProfile,
    getRole,
    applyForAgent,
    getMyMessages,
    sendMessageToAdmin,
    markMessageRead,
    deleteMessage,
    getMyNotifications,
    getUnreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
    getMyAgentApplication,
    getApiKey,
    regenerateApiKey,
    getApiKeys,
    createApiKey,
    deleteApiKey,
    getMyActivityLogs,
    getPartnerProfile,
    updatePartnerSettings,
    getPartnerLogs
} = require('../controllers/user.controller');
const {
    getMyMtnApprovals,
    getMyPendingCount,
    getMyApprovalOrders,
    exportMyMtnApprovals,
    markMySeen
} = require('../controllers/userMtnApproval.controller');

// All routes require authentication
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.get('/role', auth, getRole);
router.get('/activity', auth, getMyActivityLogs);

// Agent application
router.post('/apply-agent', auth, applyForAgent);
router.get('/agent-application', auth, getMyAgentApplication);

// API Key management (SuperAgent & Admin only)
router.get('/api-key', auth, superAgentOrAdmin, getApiKey);
router.post('/api-key/regenerate', auth, superAgentOrAdmin, regenerateApiKey);
router.get('/api-keys', auth, superAgentOrAdmin, getApiKeys);
router.post('/api-keys', auth, superAgentOrAdmin, createApiKey);
router.delete('/api-keys/:id', auth, superAgentOrAdmin, deleteApiKey);

// Messages
router.get('/messages', auth, getMyMessages);
router.post('/messages', auth, sendMessageToAdmin);
router.put('/messages/:id/read', auth, markMessageRead);
router.delete('/messages/:id', auth, deleteMessage);

// Notifications
router.get('/notifications/unread-count', auth, getUnreadNotificationsCount);
router.get('/notifications', auth, getMyNotifications);
router.put('/notifications/:id/read', auth, markNotificationRead);
router.put('/notifications/mark-all-read', auth, markAllNotificationsRead);
router.delete('/notifications/:id', auth, deleteNotification);
router.delete('/notifications', auth, clearAllNotifications);

// Partner Console
router.get('/partner-profile', auth, getPartnerProfile);
router.put('/partner-profile', auth, updatePartnerSettings);
router.get('/partner-logs', auth, getPartnerLogs);

// Pending MTN Approvals (role-based, all authenticated users)
router.get('/mtn-approvals/export', auth, exportLimiter, exportMyMtnApprovals);
router.get('/mtn-approvals', auth, getMyMtnApprovals);
router.get('/mtn-approvals/count', auth, getMyPendingCount);
router.post('/mtn-approvals/mark-seen', auth, markMySeen);
router.get('/mtn-approvals/:id/orders', auth, getMyApprovalOrders);

module.exports = router;
