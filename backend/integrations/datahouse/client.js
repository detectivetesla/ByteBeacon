const https = require('https');
const http = require('http');

/**
 * Centralized, Secure DataHouse HTTP Client
 * - Exclusively server-side: injects x-api-key header
 * - Preserves correlationId in server logs for diagnostics
 * - Formats DataHouse response envelopes consistently
 * - Implements controlled exponential backoff for 429 Rate Limiting
 */

const DEFAULT_BASE_URL = 'https://api.getmorepaylessdatahouse.net/api/v1';

function getBaseUrl() {
    return process.env.DATAHOUSE_API_BASE_URL || DEFAULT_BASE_URL;
}

function getApiKey() {
    const key = process.env.DATAHOUSE_API_KEY;
    if (!key || typeof key !== 'string' || key.trim() === '') {
        return null;
    }
    return key.trim();
}

/**
 * Execute raw HTTP/HTTPS request to DataHouse API with automatic rate-limit backoff
 *
 * @param {Object} options
 * @param {string} options.method - 'GET' | 'POST' | 'PUT' | 'DELETE'
 * @param {string} options.path - endpoint path e.g. '/agent/orders'
 * @param {Object} [options.body] - JSON request payload
 * @param {Object} [options.headers] - Extra custom headers
 * @param {number} [options.timeout=15000] - Request timeout in ms
 * @param {number} [options.maxRetries=2] - Max retries for 429 / network blips
 * @returns {Promise<{ ok: boolean, status: number, data: any, error: any, correlationId: string|null }>}
 */
async function request({ method, path, body = null, headers = {}, timeout = 15000, maxRetries = 2 }) {
    const apiKey = getApiKey();
    if (!apiKey) {
        const errorMsg = 'DATAHOUSE_API_KEY is not configured in server environment.';
        console.error(`❌ [DataHouse Client] ${errorMsg}`);
        return {
            ok: false,
            status: 500,
            error: { code: 'CONFIG_ERROR', message: errorMsg },
            correlationId: null
        };
    }

    const baseUrl = getBaseUrl();
    const urlObj = new URL(baseUrl);
    const basePath = urlObj.pathname.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const fullPath = `${basePath}${cleanPath}`;

    let attempts = 0;
    while (attempts <= maxRetries) {
        attempts++;
        try {
            const result = await executeHttpCall({
                urlObj,
                fullPath,
                method,
                apiKey,
                body,
                headers,
                timeout
            });

            // Log correlation ID if returned by DataHouse
            if (result.correlationId) {
                console.log(`🔗 [DataHouse Correlation] ${method} ${cleanPath} | ID: ${result.correlationId} | HTTP ${result.status}`);
            }

            // If rate limited (429), back off and retry up to maxRetries
            if (result.status === 429 && attempts <= maxRetries) {
                const backoffMs = Math.min(1000 * Math.pow(2, attempts), 4000);
                console.warn(`⏳ [DataHouse Client] 429 Rate Limited on ${cleanPath}. Backing off for ${backoffMs}ms before retry ${attempts}/${maxRetries}...`);
                await new Promise(r => setTimeout(r, backoffMs));
                continue;
            }

            return result;
        } catch (err) {
            console.error(`❌ [DataHouse Client] Network error on ${method} ${cleanPath} (attempt ${attempts}/${maxRetries}):`, err.message);
            if (attempts <= maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * attempts));
                continue;
            }
            return {
                ok: false,
                status: 500,
                error: { code: 'NETWORK_ERROR', message: err.message },
                correlationId: null
            };
        }
    }
}

function executeHttpCall({ urlObj, fullPath, method, apiKey, body, headers, timeout }) {
    return new Promise((resolve, reject) => {
        const httpModule = urlObj.protocol === 'http:' ? http : https;
        const requestBody = body ? JSON.stringify(body) : null;

        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'http:' ? 80 : 443),
            path: fullPath,
            method: method.toUpperCase(),
            headers: {
                'x-api-key': apiKey,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...(requestBody ? { 'Content-Length': Buffer.byteLength(requestBody) } : {}),
                ...headers
            },
            timeout
        };

        const req = httpModule.request(reqOptions, (res) => {
            let rawData = '';
            res.on('data', chunk => { rawData += chunk; });
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = rawData ? JSON.parse(rawData) : null;
                } catch {
                    parsed = { raw: rawData.substring(0, 300) };
                }

                const correlationId = parsed?.meta?.correlationId || res.headers['x-correlation-id'] || null;
                const isSuccess = res.statusCode >= 200 && res.statusCode < 300 && (parsed?.success !== false);

                if (isSuccess) {
                    resolve({
                        ok: true,
                        status: res.statusCode,
                        data: parsed?.data !== undefined ? parsed.data : parsed,
                        message: parsed?.message || 'Success',
                        correlationId
                    });
                } else {
                    const errObj = parsed?.error || {
                        code: parsed?.code || `HTTP_${res.statusCode}`,
                        message: parsed?.message || 'DataHouse request failed'
                    };
                    resolve({
                        ok: false,
                        status: res.statusCode,
                        error: errObj,
                        data: parsed?.data || null,
                        correlationId
                    });
                }
            });
        });

        req.on('timeout', () => {
            req.destroy(new Error(`DataHouse request timed out after ${timeout}ms`));
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (requestBody) {
            req.write(requestBody);
        }
        req.end();
    });
}

/**
 * Fetch current agent profile (GET /agent/me) to verify API key and load agent metadata
 */
async function getAgentProfile() {
    return await request({
        method: 'GET',
        path: '/agent/me'
    });
}

module.exports = {
    request,
    getBaseUrl,
    getApiKey,
    getAgentProfile
};
