const https = require('https');

// GetMorePayLess Datahouse API configuration
const DATAHOUSE_BASE_URL = 'https://api.getmorepaylessdatahouse.net/api/v1';

// Simple in-memory cache for Datahouse bundles
let bundlesCache = {
    data: {},
    lastFetched: {},
    TTL: 10 * 60 * 1000 // 10 minutes cache
};

/**
 * Make HTTPS request to Datahouse API
 */
const makeDatahouseRequest = (method, path, apiKey, body = null, baseUrl = null) => {
    return new Promise((resolve, reject) => {
        const defaultBase = 'https://api.getmorepaylessdatahouse.net/api/v1';
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
                'Authorization': apiKey ? (apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`) : '',
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            timeout: 15000, // 15 seconds timeout
        };

        console.log(`📡 [Datahouse] Sending ${method} to ${hostname}${fullPath}...`);

        const httpModule = urlObj.protocol === 'http:' ? require('http') : require('https');
        const req = httpModule.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = data ? JSON.parse(data) : null;
                    if (res.statusCode >= 400) {
                        console.error(`❌ Datahouse Request Error (${res.statusCode}):`, jsonData || data);
                    }
                    resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: jsonData });
                } catch (e) {
                    console.error('❌ Datahouse JSON Parse Error:', e.message, 'Raw data:', data.substring(0, 500));
                    resolve({ status: res.statusCode, ok: false, data: { error: 'Invalid JSON response', raw: data.substring(0, 200) } });
                }
            });
        });

        req.on('timeout', () => {
            console.error(`❌ Datahouse Request TIMEOUT (${method} ${fullPath})`);
            req.destroy();
            resolve({
                status: 408,
                ok: false,
                data: { error: 'Request timed out after 15 seconds' }
            });
        });

        req.on('error', (error) => {
            console.error(`❌ Datahouse Request Exception (${method} ${fullPath}):`, error.message);
            resolve({
                status: 500,
                ok: false,
                data: {
                    error: 'Network error or Datahouse is down',
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
 * Fetch available data bundles for a network
 */
const fetchBundles = async (network, apiKey, baseUrl = null) => {
    const normNetwork = network.toUpperCase();
    const now = Date.now();
    if (bundlesCache.data[normNetwork] && (now - bundlesCache.lastFetched[normNetwork]) < bundlesCache.TTL) {
        console.log(`📦 Using cached Datahouse bundles for ${normNetwork}`);
        return bundlesCache.data[normNetwork];
    }

    console.log(`📦 Fetching Datahouse bundles for ${normNetwork} from API...`);

    const response = await makeDatahouseRequest('GET', `/agent/bundles?network=${normNetwork}`, apiKey, null, baseUrl);
    console.log(`📦 Datahouse /agent/bundles?network=${normNetwork} response status:`, response.status);

    if (!response.ok || !response.data?.success) {
        const errMsg = response.data?.error?.message || response.data?.message || `Bundles request failed (HTTP ${response.status})`;
        if (bundlesCache.data[normNetwork]) {
            console.warn(`⚠️ API failed, using stale bundles cache for ${normNetwork}`);
            return bundlesCache.data[normNetwork];
        }
        throw new Error(errMsg);
    }

    let bundles = [];
    const responseData = response.data?.data;
    if (responseData) {
        if (Array.isArray(responseData)) {
            bundles = responseData;
        } else if (responseData.data && Array.isArray(responseData.data)) {
            bundles = responseData.data;
        } else if (responseData.items && Array.isArray(responseData.items)) {
            bundles = responseData.items;
        }
    }

    bundlesCache.data[normNetwork] = bundles;
    bundlesCache.lastFetched[normNetwork] = now;

    return bundles;
};

/**
 * Robustly extract data size in GB from a bundle object
 */
const getBundleSizeInGb = (b) => {
    // 1. Use dataSizeGb if present
    if (b.dataSizeGb !== undefined && b.dataSizeGb !== null) {
        return parseFloat(b.dataSizeGb);
    }
    
    // 2. Try parsing dataVolume (e.g. "8192MB", "10GB")
    if (b.dataVolume) {
        const match = String(b.dataVolume).match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
        if (match) {
            const num = parseFloat(match[1]);
            const unit = match[2].toUpperCase();
            return unit === 'MB' ? num / 1024 : num;
        }
    }
    
    // 3. Try parsing from name (e.g. "TELECEL(8GB)", "MTN 5GB")
    if (b.name) {
        const match = String(b.name).match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
        if (match) {
            const num = parseFloat(match[1]);
            const unit = match[2].toUpperCase();
            return unit === 'MB' ? num / 1024 : num;
        }
    }
    
    return null;
};

/**
 * Find matching bundle for a network and volume (in GB)
 */
const findBundle = (bundles, volume) => {
    return bundles.find((b) => {
        // If isActive is present, respect it; otherwise assume true
        const active = b.isActive !== false;
        if (!active) return false;

        const size = getBundleSizeInGb(b);
        if (size === null) return false;

        return Math.abs(size - volume) < 0.05; // 5% tolerance for sizing
    }) || null;
};

/**
 * Place a data bundle order via Datahouse API
 */
const placeDataOrder = async ({ network, dataAmount, recipientPhone, transactionId, apiKey, baseUrl }) => {
    const datahouseApiKey = apiKey || process.env.DATAHOUSE_API_KEY;
    console.log('🚀 Starting Datahouse order request...');

    if (!datahouseApiKey) {
        const errorMsg = 'DATAHOUSE_API_KEY is not configured in environment variables or database settings.';
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
    }

    try {
        console.log('🚀 Starting Datahouse order:', { network, dataAmount, recipientPhone, transactionId });

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

        // Map network string for Datahouse (MTN or TELECEL)
        let datahouseNetwork = network.toUpperCase();
        if (datahouseNetwork === 'VODAFONE' || datahouseNetwork === 'TELECEL') {
            datahouseNetwork = 'TELECEL';
        } else if (datahouseNetwork === 'MTN') {
            datahouseNetwork = 'MTN';
        } else {
            if (datahouseNetwork.includes('MTN')) datahouseNetwork = 'MTN';
            else if (datahouseNetwork.includes('TELECEL') || datahouseNetwork.includes('VODA')) datahouseNetwork = 'TELECEL';
        }

        // 3. Fetch bundles
        const bundles = await fetchBundles(datahouseNetwork, datahouseApiKey, baseUrl);
        console.log(`📋 Found ${bundles.length} bundles for ${datahouseNetwork} from Datahouse`);

        // 4. Find matching bundle
        const bundle = findBundle(bundles, volume);
        if (!bundle) {
            console.error(`❌ Available bundles for ${datahouseNetwork}:`, bundles.map(b => ({ id: b.id, name: b.name, size: b.dataSizeGb })));
            throw new Error(`No matching bundle found on Datahouse for network ${datahouseNetwork} with volume ${volume}GB`);
        }

        console.log(`✅ Using bundle: ${bundle.name} (ID: ${bundle.id})`);

        // 5. Build order payload
        const orderPayload = {
            bundleId: bundle.id,
            phoneNumber: phone,
            idempotencyKey: transactionId,
            email: 'orders@bytebeacon.com' // Safe fallback email
        };

        console.log('📤 Sending order to Datahouse:', orderPayload);

        // 6. Place order
        const orderRes = await makeDatahouseRequest('POST', '/agent/orders', datahouseApiKey, orderPayload, baseUrl);

        console.log('📥 Datahouse /agent/orders response status:', orderRes.status);
        console.log('📥 Datahouse order response:', JSON.stringify(orderRes.data, null, 2));

        // 7. Determine final status
        const orderData = orderRes.data?.data;
        const success = orderRes.data?.success || false;
        
        let finalStatus = 'processing';
        if (!success) {
            finalStatus = 'failed';
        } else {
            const portalStatus = String(orderData?.status ?? '').toLowerCase();
            if (['completed', 'success', 'delivered', 'fulfilled', 'resolved', 'delivered_callback'].includes(portalStatus)) {
                finalStatus = 'completed';
            } else if (['failed', 'error', 'cancelled', 'rejected', 'failed_callback', 'refunded', 'could_not_deliver'].includes(portalStatus)) {
                finalStatus = 'failed';
            } else {
                finalStatus = 'processing'; // received, processing
            }
        }

        return {
            success: success,
            status: finalStatus,
            apiResponse: orderRes.data,
            orderId: orderData?.id,
            orderReference: orderData?.referenceCode,
            volume,
            orderNetwork: datahouseNetwork,
            message: orderRes.data?.message || (orderRes.data?.error?.message) || (
                finalStatus === 'completed' ? 'Order successful' :
                    finalStatus === 'processing' ? 'Order placed, awaiting delivery' :
                        'Order failed'
            )
        };

    } catch (error) {
        console.error('❌ Datahouse placeDataOrder error:', error);
        return {
            success: false,
            status: 'failed',
            error: error.message,
            message: error.message || 'Datahouse API integration error'
        };
    }
};

/**
 * Check Datahouse account balance
 */
const checkBalance = async (apiKey, baseUrl = null) => {
    const datahouseApiKey = apiKey || process.env.DATAHOUSE_API_KEY;

    if (!datahouseApiKey) {
        return { success: false, error: 'API key not configured' };
    }

    try {
        const endpoints = ['/agent/wallet/balance', '/wallet/balance', '/agent/balance', '/balance'];
        let lastError = null;

        for (const endpoint of endpoints) {
            const response = await makeDatahouseRequest('GET', endpoint, datahouseApiKey, null, baseUrl);
            console.log(`💰 Datahouse balance (${endpoint}):`, response.status, response.data);

            if (response.ok && response.data) {
                const d = response.data;
                const rawBalance = d.balance ?? d.data?.balance ?? d.wallet_balance ?? d.data?.wallet_balance ?? d.amount ?? null;
                const isSuccessful = d.success === true || d.status === 'success' || d.status === 200 || response.status === 200;

                if (isSuccessful || rawBalance !== null) {
                    return {
                        success: true,
                        balance: rawBalance !== null ? parseFloat(rawBalance) : 0,
                        currency: d.currency || d.data?.currency || 'GHS'
                    };
                }
            }

            if (response.data) {
                lastError = response.data.error?.message || response.data.message || response.data.error || lastError;
            }
        }

        return {
            success: false,
            error: lastError || 'Connection failed. Please check your API Key and URL.'
        };
    } catch (error) {
        console.error('❌ Datahouse balance check error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Check order status from Datahouse
 */
const checkOrderStatus = async (orderIdOrReference, apiKey, baseUrl = null) => {
    const datahouseApiKey = apiKey || process.env.DATAHOUSE_API_KEY;

    if (!datahouseApiKey) {
        return { success: false, error: 'API key not configured' };
    }

    try {
        console.log(`🔍 Checking order status: ${orderIdOrReference}`);

        const response = await makeDatahouseRequest('GET', `/agent/orders/${orderIdOrReference}`, datahouseApiKey, null, baseUrl);
        console.log('📋 Datahouse order status:', response.data);

        if (!response.ok || !response.data?.success) {
            return {
                success: false,
                error: response.data?.error?.message || response.data?.message || `Failed to get order status (HTTP ${response.status})`
            };
        }

        const orderData = response.data?.data;
        const portalStatus = String(orderData?.status ?? '').toLowerCase();
        let mappedStatus = 'processing';

        if (['delivered', 'completed', 'success', 'fulfilled', 'resolved', 'delivered_callback'].includes(portalStatus)) {
            mappedStatus = 'completed';
        } else if (['failed', 'error', 'cancelled', 'rejected', 'failed_callback', 'refunded', 'could_not_deliver'].includes(portalStatus)) {
            mappedStatus = 'failed';
        }

        return {
            success: true,
            order: orderData,
            status: mappedStatus,
            portalStatus: portalStatus
        };
    } catch (error) {
        console.error('❌ Datahouse order status check error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Robustly extract provider order ID from API response
 */
const extractProviderId = (apiResponse, fallbackId, targetPhone) => {
    if (!apiResponse) return fallbackId;

    const isUuid = (val) => String(val || '').match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ||
        String(val || '').match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    const statusStrings = ['success', 'true', 'false', 'error', 'failed', 'completed', 'pending', 'processing', 'delivered', 'delivered_callback', 'resolved', 'refunded', 'received'];
    const normTarget = targetPhone ? normalizeGhanaPhone(targetPhone) : null;

    try {
        let data;
        try {
            data = typeof apiResponse === 'string' ? JSON.parse(apiResponse) : apiResponse;
        } catch (e) {
            const strVal = String(apiResponse).trim();
            if (strVal && strVal.length > 5 && !isUuid(strVal) && !statusStrings.includes(strVal.toLowerCase())) {
                return strVal;
            }
            return fallbackId;
        }

        if (!data) return fallbackId;

        // Check if data is inside envelope
        const payload = data.data || data;

        if (payload.publicId) return String(payload.publicId);
        if (payload.id && !isUuid(payload.id)) return String(payload.id);
        if (payload.referenceCode && !isUuid(payload.referenceCode)) return String(payload.referenceCode);
        if (payload.orderId && !isUuid(payload.orderId)) return String(payload.orderId);
        if (payload.items?.[0]?.orderId && !isUuid(payload.items[0].orderId)) return String(payload.items[0].orderId);

        const findId = (obj, usePhoneMatch, depth = 0) => {
            if (!obj || typeof obj !== 'object' || depth > 5) return null;

            if (usePhoneMatch && normTarget) {
                const recipient = obj.recipient || obj.recipientPhone || obj.beneficiary_msisdn || obj.phone || obj.msisdn || obj.phoneNumber;
                if (recipient) {
                    const normRecipient = normalizeGhanaPhone(recipient);
                    if (normRecipient !== normTarget) return null;
                }
            }

            const keys = ['publicId', 'public_id', '_id', 'order_id', 'orderId', 'id', 'reference', 'trans_id', 'transaction_id', 'requestId', 'request_id', 'provider_reference', 'provider_id', 'referenceCode'];
            for (const key of keys) {
                const val = obj[key];
                if (val && !isUuid(val) && !statusStrings.includes(String(val).toLowerCase())) {
                    if (normTarget && normalizeGhanaPhone(String(val)) === normTarget) continue;
                    if (typeof val === 'string' && val.length < 4) continue;
                    return String(val);
                }
            }

            const arrayKeys = ['orders', 'items', 'data', 'history', 'results'];
            for (const arrayKey of arrayKeys) {
                if (Array.isArray(obj[arrayKey])) {
                    for (const item of obj[arrayKey]) {
                        const res = findId(item, usePhoneMatch, depth + 1);
                        if (res) return res;
                    }
                }
            }

            for (const key in obj) {
                if (obj[key] && typeof obj[key] === 'object' && !['portal02_webhook', 'datahouse_webhook'].includes(key)) {
                    if (Array.isArray(obj[key])) continue;
                    const res = findId(obj[key], usePhoneMatch, depth + 1);
                    if (res) return res;
                }
            }
            return null;
        };

        let result = findId(data, true);
        if (!result) {
            result = findId(data, false);
        }

        if (!result) {
            console.warn(`⚠️ extractProviderId: ID discovery failed for ${fallbackId}. Data keys: ${Object.keys(data).join(', ')}`);
        } else if (result !== fallbackId) {
            console.log(`... extractProviderId: Discovered identifier "${result}" for ${fallbackId}`);
        }

        return result || fallbackId;
    } catch (e) {
        return fallbackId;
    }
};

module.exports = {
    placeDataOrder,
    normalizeGhanaPhone,
    fetchBundles,
    findBundle,
    checkBalance,
    checkOrderStatus,
    extractProviderId
};
