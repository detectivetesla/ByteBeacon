const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
    register,
    login,
    getMe,
    requestPasswordReset,
    verifyResetToken,
    executePasswordReset,
    logout,
    changePassword,
    googleLogin
} = require('../controllers/auth.controller');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);

// Password reset routes (public)
router.post('/forgot-password', requestPasswordReset);
router.get('/verify-reset-token/:token', verifyResetToken);
router.post('/reset-password', executePasswordReset);

// Protected routes
router.get('/me', auth, getMe);
router.post('/logout', auth, logout);
router.post('/change-password', auth, changePassword);

module.exports = router;
