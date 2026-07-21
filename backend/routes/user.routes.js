const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
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

// All routes require authentication
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.get('/role', auth, getRole);
router.get('/activity', auth, getMyActivityLogs);

// Agent application
router.post('/apply-agent', auth, applyForAgent);
router.get('/agent-application', auth, getMyAgentApplication);

// API Key management
router.get('/api-key', auth, getApiKey);
router.post('/api-key/regenerate', auth, regenerateApiKey);
router.get('/api-keys', auth, getApiKeys);
router.post('/api-keys', auth, createApiKey);
router.delete('/api-keys/:id', auth, deleteApiKey);

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

module.exports = router;
