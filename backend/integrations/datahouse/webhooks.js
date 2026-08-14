const crypto = require('crypto');
const pool = require('../../config/database');

/**
 * DataHouse Webhook Verification & Idempotency Engine
 * Enforces HMAC-SHA256 signature verification over raw request body and prevents duplicate event delivery.
 */

const TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes window

/**
 * Verify DataHouse HMAC-SHA256 signature
 *
 * @param {Object} params
 * @param {string} params.signatureHeader - Raw 'X-Telecom-Signature' header value
 * @param {Buffer|string} params.rawBody - Raw unmodified request body Buffer
 * @param {string} [params.secret] - Optional secret override (defaults to process.env.DATAHOUSE_WEBHOOK_SECRET)
 * @returns {{ valid: boolean, reason?: string, timestamp?: number }}
 */
function verifyWebhookSignature({ signatureHeader, rawBody, secret }) {
    const webhookSecret = secret || process.env.DATAHOUSE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.warn('⚠️ [DataHouse Webhook] DATAHOUSE_WEBHOOK_SECRET not set — rejecting unsigned request in strict mode.');
        return { valid: false, reason: 'WEBHOOK_SECRET_NOT_CONFIGURED' };
    }

    if (!signatureHeader || typeof signatureHeader !== 'string') {
        return { valid: false, reason: 'MISSING_SIGNATURE_HEADER' };
    }

    try {
        let timestamp = null;
        let signatureHex = null;

        // Support standard t=<ts>,v1=<hex> as well as direct sha256=<hex> or raw hex
        if (signatureHeader.includes('=')) {
            const parts = signatureHeader.split(',');
            for (const part of parts) {
                const [k, v] = part.trim().split('=');
                if (k === 't') timestamp = parseInt(v, 10);
                if (k === 'v1' || k === 'sha256') signatureHex = v;
            }
        }

        if (!signatureHex) {
            signatureHex = signatureHeader.trim();
        }

        // Validate timestamp expiration if provided
        if (timestamp) {
            const nowSec = Math.floor(Date.now() / 1000);
            if (Math.abs(nowSec - timestamp) > TIMESTAMP_TOLERANCE_SECONDS) {
                return { valid: false, reason: 'TIMESTAMP_EXPIRED', timestamp };
            }
        }

        // Prepare raw string
        const rawString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : (typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody));
        const payloadToSign = timestamp ? `${timestamp}.${rawString}` : rawString;

        const expectedSignatureHex = crypto
            .createHmac('sha256', webhookSecret)
            .update(payloadToSign)
            .digest('hex');

        // Constant-time comparison
        const sigBuffer = Buffer.from(signatureHex, 'hex');
        const expectedBuffer = Buffer.from(expectedSignatureHex, 'hex');

        if (sigBuffer.length !== expectedBuffer.length) {
            return { valid: false, reason: 'SIGNATURE_LENGTH_MISMATCH' };
        }

        const matches = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
        return {
            valid: matches,
            reason: matches ? null : 'SIGNATURE_MISMATCH',
            timestamp
        };
    } catch (err) {
        return { valid: false, reason: `SIGNATURE_PARSING_ERROR: ${err.message}` };
    }
}

/**
 * Extract Delivery ID / Event ID from request
 *
 * @param {Object} headers
 * @param {Object} body
 * @returns {string}
 */
function extractDeliveryId(headers, body) {
    const headerDeliveryId = headers['x-telecom-delivery-id'] || headers['X-Telecom-Delivery-Id'];
    if (headerDeliveryId && typeof headerDeliveryId === 'string') {
        return headerDeliveryId.trim();
    }
    return body?.id || body?.event_id || body?.eventId || `evt_${body?.type || 'unknown'}_${body?.data?.id || body?.data?.order_id || Date.now()}`;
}

/**
 * Check if a webhook delivery has already been processed (Idempotency)
 *
 * @param {string} deliveryId
 * @returns {Promise<boolean>}
 */
async function isDuplicateDelivery(deliveryId) {
    if (!deliveryId) return false;
    try {
        const [rows] = await pool.execute(
            'SELECT id, processed FROM datahouse_webhook_logs WHERE event_id = ?',
            [deliveryId]
        );
        return rows.length > 0 && rows[0].processed === true;
    } catch (e) {
        console.warn('⚠️ [DataHouse Webhook] Idempotency lookup error:', e.message);
        return false;
    }
}

/**
 * Record and mark a webhook event as processed in audit table
 *
 * @param {Object} params
 * @param {string} params.deliveryId
 * @param {string} params.eventType
 * @param {string} [params.orderId]
 * @param {string} [params.referenceCode]
 * @param {Object} params.payload
 */
async function recordWebhookEvent({ deliveryId, eventType, orderId, referenceCode, payload }) {
    try {
        await pool.execute(
            `INSERT INTO datahouse_webhook_logs (event_id, event_type, datahouse_order_id, reference_code, payload, processed, created_at)
             VALUES (?, ?, ?, ?, ?::jsonb, true, CURRENT_TIMESTAMP)
             ON CONFLICT (event_id) DO UPDATE 
             SET processed = true`,
            [
                deliveryId,
                eventType,
                orderId || null,
                referenceCode || null,
                JSON.stringify(payload)
            ]
        );
    } catch (e) {
        console.warn('⚠️ [DataHouse Webhook] Could not persist webhook log:', e.message);
    }
}

module.exports = {
    verifyWebhookSignature,
    extractDeliveryId,
    isDuplicateDelivery,
    recordWebhookEvent
};
