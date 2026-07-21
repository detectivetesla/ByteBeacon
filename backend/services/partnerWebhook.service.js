const pool = require('../config/database');
const crypto = require('crypto');
const dns = require('dns').promises;
const { decryptSecret } = require('../utils/encryption');

// Helper to determine if an IP address lies in loopback or private networks (SSRF defense)
const isPrivateIp = (ip) => {
    if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') return true;
    
    // Check IPv4 octets
    const parts = ip.split('.').map(Number);
    if (parts.length === 4) {
        // 10.0.0.0/8
        if (parts[0] === 10) return true;
        // 172.16.0.0/12
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        // 192.168.0.0/16
        if (parts[0] === 192 && parts[1] === 168) return true;
        // 169.254.0.0/16 (Link Local AWS metadata)
        if (parts[0] === 169 && parts[1] === 254) return true;
    }
    return false;
};

/**
 * Validates that a webhook URL is public and safe from SSRF attacks
 * @param {string} urlStr - Target URL
 * @returns {Promise<boolean>}
 */
const validateWebhookUrl = async (urlStr) => {
    try {
        if (!urlStr) return false;
        const url = new URL(urlStr);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return false;
        }
        
        // Resolve host to IP
        const lookup = await dns.lookup(url.hostname);
        if (isPrivateIp(lookup.address)) {
            console.warn(`🚨 SSRF Blocked: Webhook URL ${urlStr} resolved to private/internal IP ${lookup.address}`);
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
};

const RETRY_INTERVALS = [0, 1, 5, 15, 60]; // minutes (index 1 is 1st retry, index 2 is 2nd retry, etc.)

/**
 * Helper to execute a single webhook HTTP POST request
 */
const sendWebhookRequest = async (webhookUrl, payload, apiSecret) => {
    const payloadString = JSON.stringify(payload);
    
    // Compute HMAC signature using decrypted partner secret
    const signature = crypto.createHmac('sha256', apiSecret).update(payloadString).digest('hex');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-ByteBeacon-Signature': signature,
                'User-Agent': 'ByteBeacon-Webhook-Dispatcher/1.0'
            },
            body: payloadString,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const bodyText = await response.text();
        return {
            success: response.ok,
            statusCode: response.status,
            responseBody: bodyText.slice(0, 1000) // Keep logs within limits
        };
    } catch (err) {
        clearTimeout(timeoutId);
        return {
            success: false,
            statusCode: err.name === 'AbortError' ? 408 : 500,
            responseBody: `Error: ${err.message}`
        };
    }
};

/**
 * Triggers a webhook dispatch immediately for a transaction
 */
const triggerTransactionWebhook = async (transactionId, status) => {
    try {
        // 1. Fetch transaction and check if it belongs to a partner
        const [txs] = await pool.execute(
            `SELECT t.id, t.partner_id, t.recipient_phone, t.amount_ghc, t.paystack_reference, t.api_response,
                    d.network, d.data_amount
             FROM transactions t
             LEFT JOIN data_bundles d ON t.bundle_id = d.id::uuid
             WHERE t.id = ?::uuid`,
            [transactionId]
        );

        if (txs.length === 0 || !txs[0].partner_id) return;
        const tx = txs[0];

        // 2. Fetch partner configuration
        const [partners] = await pool.execute(
            'SELECT webhook_url, api_secret_encrypted, api_secret_iv, api_secret_auth_tag FROM partners WHERE id = ?::uuid',
            [tx.partner_id]
        );

        if (partners.length === 0 || !partners[0].webhook_url) return;
        const partner = partners[0];

        // 3. SSRF verification
        const isUrlSafe = await validateWebhookUrl(partner.webhook_url);
        if (!isUrlSafe) {
            console.error(`❌ Webhook dispatch cancelled for safe-check failure: ${partner.webhook_url}`);
            return;
        }

        // 4. Decrypt secret & Format payload
        const apiSecret = decryptSecret(
            partner.api_secret_encrypted,
            partner.api_secret_iv,
            partner.api_secret_auth_tag
        );

        let parsedApiResponse = {};
        try {
            parsedApiResponse = typeof tx.api_response === 'string' 
                ? JSON.parse(tx.api_response) 
                : (tx.api_response || {});
        } catch (e) {}

        const payload = {
            transaction_id: tx.id,
            status: status,
            reference: parsedApiResponse.reference || tx.paystack_reference || '',
            network: tx.network || '',
            phone: tx.recipient_phone,
            amount: parseFloat(tx.amount_ghc)
        };

        // 5. Send POST
        console.log(`📡 [WEBHOOK] Dispatching webhook to ${partner.webhook_url} for transaction ${tx.id}...`);
        const result = await sendWebhookRequest(partner.webhook_url, payload, apiSecret);

        // 6. Log attempt in database
        const logId = crypto.randomUUID();
        const finalStatus = result.success ? 'success' : 'failed';
        
        let nextAttemptAt = null;
        if (!result.success) {
            const nextInterval = RETRY_INTERVALS[1]; // 1 minute for 1st retry
            nextAttemptAt = new Date();
            nextAttemptAt.setMinutes(nextAttemptAt.getMinutes() + nextInterval);
            console.warn(`⚠️ [WEBHOOK] Dispatch failed (Code: ${result.statusCode}). Scheduling 1st retry at ${nextAttemptAt.toISOString()}`);
        } else {
            console.log(`✅ [WEBHOOK] Dispatch succeeded (Code: ${result.statusCode}) for ${tx.id}`);
        }

        await pool.execute(
            `INSERT INTO partner_webhook_logs (id, partner_id, transaction_id, webhook_url, payload, attempt, status, response_code, response_body, next_attempt_at)
             VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?::jsonb, 1, ?, ?, ?, ?)`,
            [
                logId,
                tx.partner_id,
                tx.id,
                partner.webhook_url,
                JSON.stringify(payload),
                finalStatus,
                result.statusCode,
                result.responseBody,
                nextAttemptAt
            ]
        );

    } catch (err) {
        console.error('❌ Webhook trigger error:', err.message);
    }
};

/**
 * Processes pending webhook retries in the queue
 */
const processWebhookQueue = async () => {
    try {
        // Fetch failed/pending webhook logs that are due for retry
        const [logs] = await pool.execute(`
            SELECT wl.*, p.api_secret_encrypted, p.api_secret_iv, p.api_secret_auth_tag
            FROM partner_webhook_logs wl
            JOIN partners p ON wl.partner_id = p.id::uuid
            WHERE wl.status = 'failed'
            AND wl.attempt < 5
            AND wl.next_attempt_at <= CURRENT_TIMESTAMP
            LIMIT 10
        `);

        if (logs.length === 0) return { processed: 0 };

        console.log(`🔄 [WEBHOOK QUEUE] Found ${logs.length} webhooks to retry...`);

        for (const log of logs) {
            try {
                // SSRF check again
                const isUrlSafe = await validateWebhookUrl(log.webhook_url);
                if (!isUrlSafe) {
                    await pool.execute(
                        "UPDATE partner_webhook_logs SET status = 'permanent_failed', response_body = 'Blocked by SSRF protection', updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid",
                        [log.id]
                    );
                    continue;
                }

                const apiSecret = decryptSecret(
                    log.api_secret_encrypted,
                    log.api_secret_iv,
                    log.api_secret_auth_tag
                );

                const nextAttempt = log.attempt + 1;
                console.log(`📡 [WEBHOOK QUEUE] Retrying webhook ${log.id} (Attempt: ${nextAttempt}) to ${log.webhook_url}...`);
                const result = await sendWebhookRequest(log.webhook_url, log.payload, apiSecret);

                if (result.success) {
                    console.log(`✅ [WEBHOOK QUEUE] Retry succeeded for log ${log.id}`);
                    await pool.execute(
                        "UPDATE partner_webhook_logs SET status = 'success', attempt = ?, response_code = ?, response_body = ?, next_attempt_at = NULL WHERE id = ?::uuid",
                        [nextAttempt, result.statusCode, result.responseBody, log.id]
                    );
                } else {
                    const maxRetriesReached = nextAttempt >= 5;
                    let nextAttemptAt = null;
                    
                    if (!maxRetriesReached) {
                        const waitMinutes = RETRY_INTERVALS[nextAttempt] || 60;
                        nextAttemptAt = new Date();
                        nextAttemptAt.setMinutes(nextAttemptAt.getMinutes() + waitMinutes);
                        console.warn(`⚠️ [WEBHOOK QUEUE] Retry failed. Scheduling attempt ${nextAttempt + 1} at ${nextAttemptAt.toISOString()}`);
                    } else {
                        console.error(`🛑 [WEBHOOK QUEUE] Max retries reached for log ${log.id}. Dispatch marked as permanently failed.`);
                    }

                    await pool.execute(
                        `UPDATE partner_webhook_logs 
                         SET status = ?, attempt = ?, response_code = ?, response_body = ?, next_attempt_at = ? 
                         WHERE id = ?::uuid`,
                        [
                            maxRetriesReached ? 'permanent_failed' : 'failed',
                            nextAttempt,
                            result.statusCode,
                            result.responseBody,
                            nextAttemptAt,
                            log.id
                        ]
                    );
                }
            } catch (err) {
                console.error(`❌ Webhook queue process error for log ${log.id}:`, err.message);
            }
        }

        return { processed: logs.length };
    } catch (error) {
        console.error('❌ Error processing webhook queue:', error.message);
        return { error: error.message };
    }
};

module.exports = {
    triggerTransactionWebhook,
    processWebhookQueue,
    validateWebhookUrl
};
