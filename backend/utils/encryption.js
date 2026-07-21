const crypto = require('crypto');

// Get encryption key from environment (must resolve to 32 bytes).
// Fallback to hashing JWT_SECRET in dev if not explicitly set.
const getEncryptionKey = () => {
    const keyString = process.env.API_ENCRYPTION_KEY;
    if (!keyString) {
        // Fallback for development
        const fallback = process.env.JWT_SECRET || 'fallback-encryption-key-for-dev-32chars';
        return crypto.createHash('sha256').update(fallback).digest();
    }
    if (keyString.length === 64) {
        return Buffer.from(keyString, 'hex');
    }
    return crypto.createHash('sha256').update(keyString).digest();
};

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts clear-text API secrets using AES-256-GCM
 * @param {string} text - Plain text secret
 * @returns {object} { encrypted, iv, authTag }
 */
const encryptSecret = (text) => {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12); // Standard 12 bytes for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag
    };
};

/**
 * Decrypts encrypted API secrets
 * @param {string} encryptedText - Encrypted hex string
 * @param {string} ivHex - Initialization vector hex
 * @param {string} authTagHex - Authenticated auth tag hex
 * @returns {string} Plain text secret
 */
const decryptSecret = (encryptedText, ivHex, authTagHex) => {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
};

module.exports = { encryptSecret, decryptSecret };
