const pool = require('../config/database');
const crypto = require('crypto');
const { decryptSecret } = require('../utils/encryption');

// Memory tracker for RPM rate limiting (highly optimized sliding window per minute)
const partnerRpmTracker = {};

// Helper to resolve client IP securely (prioritizing Cloudflare connecting IP)
const getClientIp = (req) => {
    return req.headers['cf-connecting-ip'] ||
        (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.ip);
};

// Helper to log partner request audits asynchronously
const logPartnerRequest = async (partnerId, req, statusCode) => {
    try {
        const ip = getClientIp(req);
        // Obfuscate sensitive credentials from logs if present
        let bodyToLog = null;
        if (req.method === 'POST' && req.body) {
            const bodyCopy = { ...req.body };
            if (bodyCopy.secret) bodyCopy.secret = '***';
            if (bodyCopy.api_secret) bodyCopy.api_secret = '***';
            bodyToLog = JSON.stringify(bodyCopy);
        }
        
        await pool.execute(
            `INSERT INTO partner_api_logs (partner_id, ip_address, method, path, request_body, response_code, user_agent)
             VALUES (?::uuid, ?, ?, ?, ?, ?, ?)`,
            [
                partnerId || null,
                ip,
                req.method,
                req.path,
                bodyToLog,
                statusCode,
                req.headers['user-agent'] || null
            ]
        );
    } catch (err) {
        console.error('⚠️ Failed to log partner request audit:', err.message);
    }
};

const checkRpmLimit = (partnerId, limit) => {
    const now = Math.floor(Date.now() / 60000); // Current minute epoch
    if (!partnerRpmTracker[partnerId]) {
        partnerRpmTracker[partnerId] = { minute: now, count: 1 };
        return true;
    }
    const tracker = partnerRpmTracker[partnerId];
    if (tracker.minute === now) {
        tracker.count += 1;
        return tracker.count <= limit;
    } else {
        tracker.minute = now;
        tracker.count = 1;
        return true;
    }
};

const partnerAuth = async (req, res, next) => {
    try {
        // 1. Extract API Key (support headers, query params, and body for SMM/reseller integration)
        let apiKey = req.headers['x-api-key'];
        if (!apiKey && req.headers['authorization']) {
            const parts = req.headers['authorization'].split(' ');
            if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
                apiKey = parts[1];
            }
        }
        if (!apiKey && req.query) {
            apiKey = req.query.api_key || req.query.key || req.query.apiKey;
        }
        if (!apiKey && req.body) {
            apiKey = req.body.api_key || req.body.key || req.body.apiKey;
        }

        if (!apiKey) {
            await logPartnerRequest(null, req, 401);
            return res.status(401).json({ success: false, error: 'Unauthorized', message: 'API key is missing.' });
        }

        // 2. Fetch Partner Record (supporting both production, test keys, and custom agent/superagent keys)
        let partner = null;
        let isTest = apiKey.startsWith('bb_test_') || apiKey.startsWith('dk_test_');

        const [partners] = await pool.execute(
            'SELECT * FROM partners WHERE (api_key = ? OR test_api_key = ?) AND status = ?',
            [apiKey, apiKey, 'active']
        );

        if (partners.length > 0) {
            partner = partners[0];
        } else {
            // Check if key is a user API key for agent, superagent, or admin
            const [userKeys] = await pool.execute(
                `SELECT u.uuid, COALESCE(p.full_name, u.name) as name, COALESCE(ur.role::text, u.role::text, 'customer') as role, u.wallet_balance as balance, k.id as key_id, k.name as key_name 
                 FROM user_api_keys k 
                 JOIN users u ON k.user_id = u.uuid 
                 LEFT JOIN user_roles ur ON u.uuid = ur.user_id::uuid
                 LEFT JOIN profiles p ON u.uuid = p.id
                 WHERE k.api_key = ? AND k.is_active = TRUE`,
                [apiKey]
            );

            if (userKeys.length > 0) {
                const userRow = userKeys[0];
                if (userRow.role === 'agent' || userRow.role === 'superagent' || userRow.role === 'admin') {
                    // Update last used timestamp in user_api_keys asynchronously
                    pool.execute('UPDATE user_api_keys SET last_used = NOW() WHERE id = ?::uuid', [userRow.key_id]).catch(console.error);

                    partner = {
                        id: userRow.uuid,
                        user_id: userRow.uuid,
                        business_name: `${userRow.name || 'User'}'s API`,
                        wallet_balance: userRow.balance || 0.00,
                        credit_enabled: false,
                        credit_limit: 0.00,
                        outstanding_balance: 0.00,
                        allow_unlimited_purchases: false,
                        rate_limit_rpm: 100, // higher limit for agents
                        rate_limit_rph: 5000,
                        rate_limit_rpd: 50000,
                        status: 'active',
                        ip_whitelist: null,
                        api_secret_encrypted: null, // Null indicates a simple key, no HMAC signature verification required for standard agent keys!
                        is_agent: true
                    };
                }
            }
        }

        if (!partner) {
            await logPartnerRequest(null, req, 401);
            return res.status(401).json({ success: false, error: 'Unauthorized', message: 'API Key is invalid or inactive.' });
        }

        req.partner = partner; // Attach partner config to request
        req.isTest = isTest;

        // 3. IP Whitelist Validation
        const clientIp = getClientIp(req);
        if (partner.ip_whitelist) {
            const whitelistedIps = partner.ip_whitelist.split(',').map(ip => ip.trim());
            if (!whitelistedIps.includes(clientIp)) {
                console.warn(`🚨 Blocked partner request from unauthorized IP ${clientIp} for partner ${partner.business_name}`);
                await logPartnerRequest(partner.id, req, 403);
                return res.status(403).json({ success: false, error: 'Forbidden', message: `IP Address ${clientIp} is not whitelisted.` });
            }
        }

        // 4. HMAC Request Signature & Replay Prevention (Mandatory for write requests)
        const isWriteRequest = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
        const signature = req.headers['x-bytebeacon-signature'];
        const timestamp = req.headers['x-bytebeacon-timestamp'];
        const nonce = req.headers['x-bytebeacon-nonce'];

        if ((isWriteRequest || signature) && partner.api_secret_encrypted) {
            // Write requests MUST be signed
            if (!signature || !timestamp || !nonce) {
                await logPartnerRequest(partner.id, req, 400);
                return res.status(400).json({ 
                    success: false, 
                    error: 'Bad Request', 
                    message: 'HMAC headers (x-bytebeacon-signature, x-bytebeacon-timestamp, x-bytebeacon-nonce) are required for this request.' 
                });
            }

            // A. Timestamp check (reject if older than 5 minutes)
            const requestTime = parseInt(timestamp, 10);
            const currentTime = Math.floor(Date.now() / 1000);
            if (isNaN(requestTime) || Math.abs(currentTime - requestTime) > 300) {
                await logPartnerRequest(partner.id, req, 400);
                return res.status(400).json({ success: false, error: 'Bad Request', message: 'Request timestamp is invalid or has expired (skew > 5 mins).' });
            }

            // B. Nonce unique check (prevent replay attacks)
            try {
                await pool.execute('INSERT INTO partner_nonces (nonce) VALUES (?)', [nonce]);
            } catch (nonceErr) {
                // If it fails due to unique constraint, it is a duplicate nonce!
                console.warn(`🚨 Replay attack blocked! Duplicate nonce detected: ${nonce}`);
                await logPartnerRequest(partner.id, req, 400);
                return res.status(400).json({ success: false, error: 'Bad Request', message: 'Replay attack detected. Nonce has already been processed.' });
            }

            // C. Validate Signature
            try {
                const secretFieldEncrypted = req.isTest ? partner.test_api_secret_encrypted : partner.api_secret_encrypted;
                const secretFieldIv = req.isTest ? partner.test_api_secret_iv : partner.api_secret_iv;
                const secretFieldAuthTag = req.isTest ? partner.test_api_secret_auth_tag : partner.api_secret_auth_tag;

                const apiSecret = decryptSecret(
                    secretFieldEncrypted,
                    secretFieldIv,
                    secretFieldAuthTag
                );

                const dataToSign = req.rawBody || Buffer.from('');
                const computedSignature = crypto.createHmac('sha256', apiSecret).update(dataToSign).digest('hex');

                if (!crypto.timingSafeEqual(Buffer.from(computedSignature, 'hex'), Buffer.from(signature, 'hex'))) {
                    await logPartnerRequest(partner.id, req, 401);
                    return res.status(401).json({ success: false, error: 'Unauthorized', message: 'HMAC signature verification failed.' });
                }
            } catch (decryptionErr) {
                console.error('Encryption/decryption error inside auth:', decryptionErr.message);
                await logPartnerRequest(partner.id, req, 500);
                return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Failed to verify signature.' });
            }
        }

        // 5. Rate Limiting Enforcer
        // A. In-Memory minute check (RPM)
        const rpmLimit = partner.rate_limit_rpm || 60;
        if (!checkRpmLimit(partner.id, rpmLimit)) {
            await logPartnerRequest(partner.id, req, 429);
            return res.status(429).json({ success: false, error: 'Too Many Requests', message: 'Rate limit exceeded (RPM).' });
        }

        // B. Database checks for Hourly/Daily limits
        const rphLimit = partner.rate_limit_rph || 1000;
        const [rphRows] = await pool.execute(
            "SELECT COUNT(*)::integer as count FROM partner_api_logs WHERE partner_id = ?::uuid AND created_at >= NOW() - INTERVAL '1 hour'",
            [partner.id]
        );
        if (rphRows[0].count >= rphLimit) {
            await logPartnerRequest(partner.id, req, 429);
            return res.status(429).json({ success: false, error: 'Too Many Requests', message: 'Rate limit exceeded (RPH).' });
        }

        const rpdLimit = partner.rate_limit_rpd || 10000;
        const [rpdRows] = await pool.execute(
            "SELECT COUNT(*)::integer as count FROM partner_api_logs WHERE partner_id = ?::uuid AND created_at >= NOW() - INTERVAL '1 day'",
            [partner.id]
        );
        if (rpdRows[0].count >= rpdLimit) {
            await logPartnerRequest(partner.id, req, 429);
            return res.status(429).json({ success: false, error: 'Too Many Requests', message: 'Rate limit exceeded (RPD).' });
        }

        // Complete audit log for successful request asynchronously
        logPartnerRequest(partner.id, req, 200);
        
        next();
    } catch (err) {
        console.error('Critical Partner Auth error:', err.message);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

module.exports = partnerAuth;
