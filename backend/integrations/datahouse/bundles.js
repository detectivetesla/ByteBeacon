const { request } = require('./client');

/**
 * DataHouse Bundle Catalog Integration
 * DataHouse is the sole source of truth for bundles, sizes, network types, and effective agent prices.
 */

// In-memory cache for fast display (Cache is strictly a cache, DataHouse is authority)
const bundleCache = {
    byNetwork: {},
    lastFetched: {},
    TTL: 5 * 60 * 1000 // 5 minutes
};

/**
 * Normalizes phone numbers to standard Ghanaian international format (233XXXXXXXXX)
 */
function normalizePhone(raw) {
    let digits = (raw ?? '').replace(/\D/g, '');
    if (digits.startsWith('2330') && digits.length === 13) {
        digits = `233${digits.slice(4)}`;
    }
    if (digits.startsWith('233') && digits.length === 12) return digits;
    if (digits.startsWith('0') && digits.length === 10) return `233${digits.slice(1)}`;
    return digits;
}

/**
 * Parse numeric GB size from bundle properties
 */
function parseBundleSizeInGb(b) {
    if (b.dataSizeGb !== undefined && b.dataSizeGb !== null && !isNaN(Number(b.dataSizeGb))) {
        return parseFloat(b.dataSizeGb);
    }
    const searchString = `${b.dataVolume || ''} ${b.name || ''}`;
    const match = searchString.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
    if (match) {
        const num = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        return unit === 'MB' ? num / 1024 : num;
    }
    return 0;
}

/**
 * Fetch bundles from DataHouse with optional filter parameters
 *
 * @param {Object} [params]
 * @param {string} [params.network] - 'MTN' | 'TELECEL' | 'AIRTELTIGO'
 * @param {string} [params.type='DATA'] - 'DATA' | 'AIRTIME'
 * @param {string} [params.search]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 * @param {boolean} [params.refresh=false]
 * @returns {Promise<{ ok: boolean, bundles: Array<Object>, total?: number, error?: any }>}
 */
async function getBundles(params = {}) {
    const {
        network,
        type = 'DATA',
        search,
        page = 1,
        limit = 50,
        refresh = false
    } = params;

    const cacheKey = `${(network || 'ALL').toUpperCase()}_${type}`;
    const now = Date.now();

    if (!refresh && !search && page === 1 && bundleCache.byNetwork[cacheKey] && (now - bundleCache.lastFetched[cacheKey] < bundleCache.TTL)) {
        return {
            ok: true,
            bundles: bundleCache.byNetwork[cacheKey]
        };
    }

    const queryParts = [];
    if (network) queryParts.push(`network=${encodeURIComponent(network.toUpperCase())}`);
    if (type) queryParts.push(`type=${encodeURIComponent(type)}`);
    if (search) queryParts.push(`search=${encodeURIComponent(search)}`);
    if (page) queryParts.push(`page=${encodeURIComponent(page)}`);
    if (limit) queryParts.push(`limit=${encodeURIComponent(limit)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const res = await request({
        method: 'GET',
        path: `/agent/bundles${queryString}`
    });

    if (!res.ok) {
        // Return cached version if network error occurs
        if (bundleCache.byNetwork[cacheKey]) {
            console.warn(`⚠️ [DataHouse Bundles] API failed, serving cached bundles for ${cacheKey}`);
            return {
                ok: true,
                bundles: bundleCache.byNetwork[cacheKey],
                fromCache: true
            };
        }
        return {
            ok: false,
            bundles: [],
            error: res.error
        };
    }

    // Extract bundle array from various envelope shapes
    let rawItems = [];
    if (Array.isArray(res.data)) {
        rawItems = res.data;
    } else if (res.data?.data && Array.isArray(res.data.data)) {
        rawItems = res.data.data;
    } else if (res.data?.items && Array.isArray(res.data.items)) {
        rawItems = res.data.items;
    } else if (res.data?.bundles && Array.isArray(res.data.bundles)) {
        rawItems = res.data.bundles;
    }

    const normalized = rawItems.map(b => ({
        id: b.id,
        network: (b.network || 'UNKNOWN').toUpperCase(),
        name: b.name || `${b.network || ''} ${b.dataVolume || ''}`,
        dataVolume: b.dataVolume || `${b.dataSizeGb || ''}GB`,
        dataSizeGb: parseBundleSizeInGb(b),
        agentAmount: parseFloat(b.agentAmount || b.priceGhc || b.amount || 0),
        amount: parseFloat(b.amount || b.priceGhc || b.agentAmount || 0),
        type: b.type || 'DATA',
        isActive: b.isActive !== false,
        validity: b.validity || '30 Days'
    })).sort((a, b) => a.dataSizeGb - b.dataSizeGb);

    if (!search && page === 1) {
        bundleCache.byNetwork[cacheKey] = normalized;
        bundleCache.lastFetched[cacheKey] = now;
    }

    return {
        ok: true,
        bundles: normalized,
        total: res.data?.total || normalized.length
    };
}

/**
 * Retrieve a specific bundle by its DataHouse bundle ID
 *
 * @param {string} bundleId
 * @returns {Promise<Object|null>}
 */
async function getBundleById(bundleId) {
    if (!bundleId) return null;
    const all = await getBundles({ limit: 100 });
    if (!all.ok) return null;
    return all.bundles.find(b => b.id === bundleId || String(b.id) === String(bundleId)) || null;
}

module.exports = {
    getBundles,
    getBundleById,
    normalizePhone,
    parseBundleSizeInGb
};
