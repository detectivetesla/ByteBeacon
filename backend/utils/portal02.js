const https = require('https');

// Portal-02 API configuration
const PORTAL02_BASE_URL = 'https://www.portal-02.com/api/v1';

// Simple in-memory cache for Portal-02 offers
let offersCache = {
    data: [],
    lastFetched: 0,
    TTL: 10 * 60 * 1000 // 10 minutes cache
};

// ISP candidates for matching offers
const ISP_CANDIDATES_MAP = {
    MTN: ['mtn', 'MTN'],
    TELECEL: ['telecel', 'Telecel', 'TELECEL', 'vodafone', 'Vodafone'],
    AIRTELTIGO: ['airteltigo', 'AirtelTigo', 'airtel', 'tigo'],
};

// Network to Portal-02 order path mapping
const ORDER_NETWORK_MAP = {
    MTN: 'mtn',
    TELECEL: 'telecel',
    AIRTELTIGO: 'at', // Portal-02 uses 'at' for AirtelTigo
};

// Fallback offer slugs for known networks (used if not found in offers API)
const FALLBACK_OFFER_SLUGS = {
    MTN: 'master_beneficiary_data_bundle',
    TELECEL: 'telecel_expiry_bundle',
    AIRTELTIGO: 'ishare_data_bundle',
};

/**
 * Make HTTPS request to Portal-02 API
 */
const makePortal02Request = (method, path, apiKey, body = null, baseUrl = null) => {
    return new Promise((resolve, reject) => {
        const defaultBase = 'https://www.portal-02.com/api/v1';
        const urlObj = new URL(baseUrl || defaultBase);
        const hostname = urlObj.hostname;
        const basePath = urlObj.pathname.replace(/\/$/, '');
        const fullPath = basePath + path;

        const options = {
            hostname: hostname,
            path: fullPath,
            method: method,
            headers: {
                'x-api-key': apiKey,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            timeout: 15000, // 15 seconds timeout
        };

        console.log(`📡 [Portal-02] Sending ${method} to ${hostname}${fullPath}...`);

        const httpModule = urlObj.protocol === 'http:' ? require('http') : require('https');
        const req = httpModule.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = data ? JSON.parse(data) : null;
                    if (res.statusCode >= 400) {
                        console.error(`❌ Portal-02 Request Error (${res.statusCode}):`, jsonData || data);
                    }
                    resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: jsonData });
                } catch (e) {
                    console.error('❌ Portal-02 JSON Parse Error:', e.message, 'Raw data:', data.substring(0, 500));
                    resolve({ status: res.statusCode, ok: false, data: { error: 'Invalid JSON response', raw: data.substring(0, 200) } });
                }
            });
        });

        req.on('timeout', () => {
            console.error(`❌ Portal-02 Request TIMEOUT (${method} ${fullPath})`);
            req.destroy();
            resolve({
                status: 408,
                ok: false,
                data: { error: 'Request timed out after 15 seconds' }
            });
        });

        req.on('error', (error) => {
            console.error(`❌ Portal-02 Request Exception (${method} ${fullPath}):`, error.message);
            resolve({
                status: 500,
                ok: false,
                data: {
                    error: 'Network error or Portal-02 is down',
                    message: error.message,
                    code: error.code
                }
            });
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
};

/**
 * Normalize phone to Ghana format (233XXXXXXXXX)
 */
const normalizeGhanaPhone = (raw) => {
    const digits = (raw ?? '').replace(/\D/g, '');
    if (digits.startsWith('233') && digits.length === 12) return digits;
    if (digits.startsWith('0') && digits.length === 10) return `233${digits.slice(1)}`;
    return digits;
};

/**
 * Fetch available offers from Portal-02
 */
const fetchOffers = async (apiKey, baseUrl = null) => {
    // Check cache first
    const now = Date.now();
    if (offersCache.data.length > 0 && (now - offersCache.lastFetched) < offersCache.TTL) {
        console.log('📦 Using cached Portal-02 offers');
        return offersCache.data;
    }

    console.log('📦 Fetching Portal-02 offers from API...');

    const response = await makePortal02Request('GET', '/offers', apiKey, null, baseUrl);
    console.log('📦 Portal-02 /offers response status:', response.status);

    if (!response.ok || !response.data?.success) {
        const errMsg = response.data?.error || `Offers request failed (HTTP ${response.status})`;
        // If we have stale cache, use it as fallback instead of failing
        if (offersCache.data.length > 0) {
            console.warn('⚠️ API failed, using stale offers cache');
            return offersCache.data;
        }
        throw new Error(errMsg);
    }

    const offers = Array.isArray(response.data?.offers) ? response.data.offers : [];

    // Update cache
    offersCache.data = offers;
    offersCache.lastFetched = now;

    return offers;
};

/**
 * Find matching offer for a network
 * Returns the offer if found, or null if not found
 */
const findOffer = (offers, network) => {
    const ispCandidates = ISP_CANDIDATES_MAP[network.toUpperCase()] || [network.toLowerCase()];

    const offer = offers.find((o) => {
        const type = String(o?.type ?? '').toLowerCase();
        const isp = String(o?.isp ?? '').toLowerCase();
        if (!type.includes('data')) return false;
        return ispCandidates.some((c) => isp === String(c).toLowerCase());
    });

    // If no offer found, return null - the fallback slug will be used
    return offer || null;
};

/**
 * Place a data bundle order via Portal-02 API
 */
const placeDataOrder = async ({ network, dataAmount, recipientPhone, transactionId, webhookBaseUrl, apiKey, baseUrl }) => {
    const portal02ApiKey = apiKey || process.env.PORTAL02_API_KEY;
    console.log('🚀 Starting Portal-02 order request...');

    if (!portal02ApiKey) {
        const errorMsg = 'PORTAL02_API_KEY is not configured in environment variables or database settings.';
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
    }

    try {
        console.log('🚀 Starting Portal-02 order:', { network, dataAmount, recipientPhone, transactionId });

        // 1. Normalize phone number
        const phone = normalizeGhanaPhone(recipientPhone);
        if (!phone || phone.length < 10) {
            throw new Error(`Invalid phone number: ${recipientPhone}`);
        }
        console.log('📱 Normalized phone:', phone);

        // 2. Parse volume from data amount (e.g., "1GB" -> 1, "500MB" -> 0.5)
        const match = (dataAmount || '').match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
        let volume = 0;
        if (match) {
            const num = parseFloat(match[1]);
            const unit = match[2].toUpperCase();
            volume = unit === 'MB' ? num / 1000 : num;
        } else {
            volume = parseInt((dataAmount || '').replace(/[^0-9]/g, ''), 10);
        }

        if (!Number.isFinite(volume) || volume <= 0) {
            throw new Error(`Invalid bundle volume: ${dataAmount}`);
        }
        console.log('📊 Parsed volume:', volume);

        // 3. Fetch offers
        const offers = await fetchOffers(portal02ApiKey, baseUrl);
        console.log(`📋 Found ${offers.length} offers from Portal-02`);

        // 4. Find matching offer (or use fallback slug)
        const offer = findOffer(offers, network);

        // Use fallback offer slug if not found but network is known
        let offerSlug = offer?.offerSlug;
        if (!offerSlug && FALLBACK_OFFER_SLUGS[network.toUpperCase()]) {
            offerSlug = FALLBACK_OFFER_SLUGS[network.toUpperCase()];
            console.log('📋 Using fallback offer slug:', offerSlug);
        }

        if (!offerSlug) {
            console.error('❌ Available offers:', offers.map(o => ({ isp: o.isp, type: o.type, slug: o.offerSlug })));
            throw new Error(`No data offer found for network: ${network}`);
        }
        console.log('✅ Using offer slug:', offerSlug);

        // 5. Warn if volume might not be available
        if (Array.isArray(offer?.volumes) && offer.volumes.length > 0) {
            const volumeMatch = offer.volumes.some(v => Math.abs(v - volume) < 0.01);
            if (!volumeMatch) {
                console.warn(`⚠️ Requested volume ${volume}GB may not be available. Available: ${offer.volumes.join(', ')}GB`);
            }
        }

        // 6. Build order payload
        const orderNetwork = ORDER_NETWORK_MAP[network.toUpperCase()] || network.toLowerCase();

        const orderPayload = {
            type: 'single',
            volume,
            phone,
            offerSlug: offerSlug,
            reference: transactionId,
        };

        // Add webhook URL if transaction ID is provided
        if (transactionId) {
            // Prioritize production URLs over localhost
            // Try to use BACKEND_URL, but fallback to FRONTEND_URL/api
            let webhookUrl = process.env.BACKEND_URL;

            if (!webhookUrl) {
                webhookUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') + '/api';
            }

            // Fallback if still no base URL or is localhost/missing environment
            const isLocal = !webhookUrl || webhookUrl.includes('localhost') || webhookUrl.includes('127.0.0.1');
            if (isLocal) {
                // If we're on a live domain, we should prefer that even if .env is missing it
                // Using the primary domain without forcing 'www' unless already present
                webhookUrl = 'https://bytebeacon.online/api';
            }

            // Format: /api/portal02/webhook?transactionId=xxx
            const cleanBaseUrl = webhookUrl.replace(/\/$/, '');
            const dynamicCallbackUrl = `${cleanBaseUrl}/portal02/webhook?transactionId=${transactionId}`;

            // Send in multiple formats for maximum compatibility with Portal02 API
            orderPayload.webhookUrl = dynamicCallbackUrl;
            orderPayload.callback_url = dynamicCallbackUrl;
            orderPayload.callbackURL = dynamicCallbackUrl;

            console.log('🔗 [Portal-02] Callback URL generated:', dynamicCallbackUrl);
        }

        console.log('📤 Sending order to Portal-02:', { orderNetwork, ...orderPayload });

        // 7. Place order
        const orderRes = await makePortal02Request('POST', `/order/${orderNetwork}`, portal02ApiKey, orderPayload, baseUrl);

        console.log('📥 Portal-02 /order response status:', orderRes.status);
        console.log('📥 Portal-02 order response:', JSON.stringify(orderRes.data, null, 2));

        // 8. Determine final status
        const orderData = orderRes.data;
        // Check for top-level status or first item status in bulk/single response
        const portalStatus = String(orderData?.status ?? orderData?.items?.[0]?.status ?? '').toLowerCase();
        let finalStatus = 'processing';

        if (!orderData?.success) {
            finalStatus = 'failed';
        } else if (['completed', 'success', 'delivered', 'fulfilled', 'resolved', 'delivered_callback'].includes(portalStatus)) {
            finalStatus = 'completed';
        } else if (['failed', 'error', 'cancelled', 'rejected', 'failed_callback', 'refunded'].includes(portalStatus)) {
            finalStatus = 'failed';
        } else if (['pending', 'processing', 'ongoing', 'queued'].includes(portalStatus)) {
            finalStatus = 'processing';
        }

        console.log(`✅ Order ${finalStatus}:`, {
            success: orderData?.success,
            portalStatus,
            finalStatus,
            orderId: orderData?.orderId,
            reference: orderData?.reference
        });

        return {
            success: orderData?.success || false,
            status: finalStatus,
            apiResponse: orderData,
            orderId: orderData?.orderId,
            orderReference: orderData?.reference,
            offerSlug: offerSlug,
            volume,
            orderNetwork,
            errorType: orderData?.type,
            message: orderData?.message || orderData?.error || (
                finalStatus === 'completed' ? 'Order successful' :
                    finalStatus === 'processing' ? 'Order placed, awaiting delivery' :
                        'Order failed'
            )
        };

    } catch (error) {
        console.error('❌ Portal-02 placeDataOrder error:', error);
        return {
            success: false,
            status: 'failed',
            error: error.message,
            message: error.message || 'Portal-02 API integration error'
        };
    }
};

/**
 * Check Portal-02 account balance
 */
const checkBalance = async (apiKey, baseUrl = null) => {
    const portal02ApiKey = apiKey || process.env.PORTAL02_API_KEY;

    if (!portal02ApiKey) {
        return { success: false, error: 'API key not configured' };
    }

    try {
        const response = await makePortal02Request('GET', '/balance', portal02ApiKey, null, baseUrl);
        console.log('💰 Portal-02 balance:', response.data);

        return {
            success: response.data?.success || false,
            balance: response.data?.balance || 0,
            currency: response.data?.currency || 'GHS'
        };
    } catch (error) {
        console.error('❌ Portal-02 balance check error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Check order status from Portal-02
 */
const checkOrderStatus = async (orderIdOrReference, apiKey, baseUrl = null) => {
    const portal02ApiKey = apiKey || process.env.PORTAL02_API_KEY;

    if (!portal02ApiKey) {
        return { success: false, error: 'API key not configured' };
    }

    try {
        console.log(`🔍 Checking order status: ${orderIdOrReference}`);

        const response = await makePortal02Request('GET', `/order/status/${orderIdOrReference}`, portal02ApiKey, null, baseUrl);
        console.log('📋 Portal-02 order status:', response.data);

        if (!response.ok || !response.data?.success) {
            return {
                success: false,
                error: response.data?.error || `Failed to get order status (HTTP ${response.status})`
            };
        }

        // Determine portal status from response
        const orderData = response.data.order || (response.data.orders ? response.data.orders[0] : response.data);
        const portalStatus = String(orderData?.status ?? '').toLowerCase();
        let mappedStatus = 'processing';

        // Map Portal-02 status to our status
        if (['delivered', 'completed', 'success', 'fulfilled', 'resolved', 'delivered_callback'].includes(portalStatus)) {
            mappedStatus = 'completed';
        } else if (['failed', 'error', 'cancelled', 'rejected', 'failed_callback', 'refunded'].includes(portalStatus)) {
            mappedStatus = 'failed';
        } else if (['pending', 'processing', 'ongoing', 'queued'].includes(portalStatus)) {
            mappedStatus = 'processing';
        }

        return {
            success: true,
            order: orderData,
            status: mappedStatus,
            portalStatus: portalStatus
        };
    } catch (error) {
        console.error('❌ Portal-02 order status check error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Robustly extract provider order ID from API response
 * Scans for numeric/string IDs while avoiding our local UUID and status keywords.
 * Performs a two-pass search:
 * 1. Targeted search matching recipient phone
 * 2. Fallback search finding ANY valid-looking ID
 */
const extractProviderId = (apiResponse, fallbackId, targetPhone) => {
    if (!apiResponse) return fallbackId;

    const isUuid = (val) => String(val || '').match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ||
        String(val || '').match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    const statusStrings = ['success', 'true', 'false', 'error', 'failed', 'completed', 'pending', 'processing', 'delivered', 'delivered_callback', 'resolved', 'refunded'];
    const normTarget = targetPhone ? normalizeGhanaPhone(targetPhone) : null;

    try {
        let data;
        try {
            data = typeof apiResponse === 'string' ? JSON.parse(apiResponse) : apiResponse;
        } catch (e) {
            // If it's a string but doesn't parse as JSON, check if it looks like an ID
            const strVal = String(apiResponse).trim();
            if (strVal && strVal.length > 5 && !isUuid(strVal) && !statusStrings.includes(strVal.toLowerCase())) {
                return strVal;
            }
            return fallbackId;
        }

        if (!data) return fallbackId;

        // If data has orderId or items[0].orderId, use that as top priority
        if (data.orderId && !isUuid(data.orderId)) return String(data.orderId);
        if (data.items?.[0]?.orderId && !isUuid(data.items[0].orderId)) return String(data.items[0].orderId);

        const findId = (obj, usePhoneMatch, depth = 0) => {
            if (!obj || typeof obj !== 'object' || depth > 5) return null;

            // 1. Phone matching check (Pass 1 only)
            if (usePhoneMatch && normTarget) {
                // Check if this object has a recipient that matches
                const recipient = obj.recipient || obj.recipientPhone || obj.beneficiary_msisdn || obj.phone || obj.msisdn;
                if (recipient) {
                    const normRecipient = normalizeGhanaPhone(recipient);
                    if (normRecipient !== normTarget) return null;
                }
            }

            // 2. Scan fields for ID
            const keys = ['_id', 'order_id', 'orderId', 'id', 'reference', 'trans_id', 'transaction_id', 'requestId', 'request_id', 'provider_reference', 'provider_id'];
            for (const key of keys) {
                const val = obj[key];
                if (val && !isUuid(val) && !statusStrings.includes(String(val).toLowerCase())) {
                    // Don't mistake the phone number itself for an ID
                    if (normTarget && normalizeGhanaPhone(String(val)) === normTarget) continue;
                    // Ensure it's not a boolean or very short string
                    if (typeof val === 'string' && val.length < 4) continue;
                    return String(val);
                }
            }

            // 3. Arrays - check them before nested objects
            const arrayKeys = ['orders', 'items', 'data', 'history', 'results'];
            for (const arrayKey of arrayKeys) {
                if (Array.isArray(obj[arrayKey])) {
                    for (const item of obj[arrayKey]) {
                        const res = findId(item, usePhoneMatch, depth + 1);
                        if (res) return res;
                    }
                }
            }

            // 4. Nested objects
            for (const key in obj) {
                if (obj[key] && typeof obj[key] === 'object' && !['portal02_webhook'].includes(key)) {
                    // If it was an array, we already checked its elements in step 3
                    if (Array.isArray(obj[key])) continue;

                    const res = findId(obj[key], usePhoneMatch, depth + 1);
                    if (res) return res;
                }
            }
            return null;
        };

        // Pass 1: Targeted Search
        let result = findId(data, true);

        // Pass 2: Global Search (if Pass 1 fails)
        if (!result) {
            result = findId(data, false);
        }

        if (!result) {
            console.warn(`⚠️ extractProviderId: ID discovery failed for ${fallbackId}. Data keys: ${Object.keys(data).join(', ')}`);
        } else if (result !== fallbackId) {
            console.log(`✅ extractProviderId: Discovered identifier "${result}" for ${fallbackId}`);
        }

        return result || fallbackId;
    } catch (e) {
        return fallbackId;
    }
};

module.exports = {
    placeDataOrder,
    normalizeGhanaPhone,
    fetchOffers,
    findOffer,
    checkBalance,
    checkOrderStatus,
    extractProviderId
};
