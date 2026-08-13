const { request } = require('./client');
const { normalizePhone, parseBundleSizeInGb } = require('./bundles');
const { v4: uuidv4, validate: uuidValidate } = require('uuid');

/**
 * DataHouse Authoritative Order Lifecycle Operations
 * DataHouse owns single and bulk order placement, child order splitting, wallet debiting, and status.
 */

/**
 * Forward a single data bundle order to DataHouse (POST /agent/orders)
 *
 * @param {Object} params
 * @param {string} params.bundleId - DataHouse bundle UUID from GET /agent/bundles
 * @param {string} params.phoneNumber - Ghanaian MSISDN (0XXXXXXXXX or +233XXXXXXXXX)
 * @param {string} [params.idempotencyKey] - UUID v4 idempotency key (generated if omitted)
 * @param {string} [params.email] - Optional customer receipt email
 * @returns {Promise<{ ok: boolean, status: number, data?: any, error?: any, correlationId?: string }>}
 */
async function createSingleOrder({ bundleId, phoneNumber, idempotencyKey, email }) {
    if (!bundleId) {
        return { ok: false, status: 400, error: { code: 'INVALID_REQUEST', message: 'bundleId is required' } };
    }

    const cleanPhone = normalizePhone(phoneNumber);
    if (!cleanPhone || cleanPhone.length < 10) {
        return { ok: false, status: 400, error: { code: 'INVALID_PHONE', message: 'Valid recipient phone number is required' } };
    }

    // Ensure valid UUID v4 for idempotency
    const validKey = (idempotencyKey && uuidValidate(idempotencyKey)) ? idempotencyKey : uuidv4();

    const payload = {
        bundleId,
        phoneNumber: cleanPhone,
        idempotencyKey: validKey
    };

    if (email && typeof email === 'string' && email.includes('@')) {
        payload.email = email.trim();
    }

    console.log(`🚀 [DataHouse Order] Submitting single order for ${cleanPhone} (bundle: ${bundleId}, key: ${validKey})...`);

    const res = await request({
        method: 'POST',
        path: '/agent/orders',
        body: payload
    });

    return res;
}

/**
 * Forward a bulk data bundle order batch to DataHouse (POST /agent/orders/bulk)
 *
 * @param {Object} params
 * @param {string} params.network - 'MTN' | 'TELECEL'
 * @param {Array<{ phoneNumber: string, dataSizeGb?: number, bundleId?: string }>} params.recipients - Batch items (1–1000)
 * @param {string} [params.idempotencyKey] - 8–36 char idempotency key
 * @param {Array<string>} [params.confirmedPorted] - Numbers on another network's prefix confirmed ported
 * @param {string} [params.onUnvalidated='set_aside'] - 'set_aside' (default) | 'reject'
 * @returns {Promise<{ ok: boolean, status: number, data?: any, error?: any, correlationId?: string }>}
 */
async function createBulkOrder({ network, recipients, idempotencyKey, confirmedPorted, onUnvalidated = 'set_aside' }) {
    if (!Array.isArray(recipients) || recipients.length === 0) {
        return { ok: false, status: 400, error: { code: 'INVALID_REQUEST', message: 'Recipients array must not be empty' } };
    }

    const validKey = idempotencyKey ? String(idempotencyKey).slice(0, 36) : uuidv4();

    const formattedRecipients = recipients.map(r => {
        const phone = normalizePhone(r.phoneNumber || r.phone || r.msisdn);
        const item = { phoneNumber: phone };

        if (r.dataSizeGb !== undefined && r.dataSizeGb !== null && !isNaN(Number(r.dataSizeGb))) {
            item.dataSizeGb = parseFloat(r.dataSizeGb);
        } else if (r.bundleId || r.bundle_id) {
            item.bundleId = r.bundleId || r.bundle_id;
        } else if (r.dataVolume || r.size) {
            item.dataSizeGb = parseBundleSizeInGb(r);
        } else {
            item.dataSizeGb = 1; // Default fallback
        }

        return item;
    });

    const payload = {
        network: (network || 'MTN').toUpperCase(),
        recipients: formattedRecipients,
        idempotencyKey: validKey,
        onUnvalidated: onUnvalidated === 'reject' ? 'reject' : 'set_aside'
    };

    if (Array.isArray(confirmedPorted) && confirmedPorted.length > 0) {
        payload.confirmedPorted = confirmedPorted.map(normalizePhone).filter(Boolean);
    }

    console.log(`🚀 [DataHouse Bulk] Submitting bulk batch with ${formattedRecipients.length} recipients to DataHouse (network: ${payload.network}, onUnvalidated: ${payload.onUnvalidated})...`);

    const res = await request({
        method: 'POST',
        path: '/agent/orders/bulk',
        body: payload
    });

    return res;
}

/**
 * Fetch authoritative order details by DataHouse public order ID (GET /agent/orders/:id)
 *
 * @param {string} orderId - DataHouse public ID (ord_01J...) or referenceCode (TXN-...)
 * @returns {Promise<{ ok: boolean, status: number, data?: any, error?: any }>}
 */
async function getOrderById(orderId) {
    if (!orderId) {
        return { ok: false, status: 400, error: { code: 'INVALID_REQUEST', message: 'Order ID is required' } };
    }

    const res = await request({
        method: 'GET',
        path: `/agent/orders/${encodeURIComponent(orderId)}`
    });

    return res;
}

/**
 * List orders from DataHouse with filtering and pagination (GET /agent/orders)
 * Note: DataHouse limits per-page requests to <= 100.
 *
 * @param {Object} [params]
 * @param {string} [params.status] - 'received' | 'processing' | 'approved' | 'partially_approved' | 'rejected' | 'paid' | 'fulfilled' | 'fulfillment_failed' | 'refunded'
 * @param {string} [params.network] - 'MTN' | 'TELECEL'
 * @param {string} [params.paymentStatus] - 'paid' | 'pending' | 'failed' | 'expired' | 'refunded' | 'partially_refunded'
 * @param {string} [params.search] - TXN reference or phone
 * @param {string} [params.after] - ISO8601 creation time lower bound
 * @param {string} [params.before] - ISO8601 creation time upper bound
 * @param {number} [params.page=1]
 * @param {number} [params.limit=30] - Default 30, Maximum 100
 * @returns {Promise<{ ok: boolean, status: number, data?: any, meta?: any, error?: any }>}
 */
async function listOrders(params = {}) {
    const {
        status,
        network,
        paymentStatus,
        search,
        after,
        before,
        page = 1,
        limit = 30
    } = params;

    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const queryParts = [
        `page=${Math.max(1, parseInt(page, 10) || 1)}`,
        `limit=${safeLimit}`
    ];

    if (status && status !== 'all') queryParts.push(`status=${encodeURIComponent(status)}`);
    if (network && network !== 'all') queryParts.push(`network=${encodeURIComponent(network.toUpperCase())}`);
    if (paymentStatus && paymentStatus !== 'all') queryParts.push(`paymentStatus=${encodeURIComponent(paymentStatus)}`);
    if (search && search.trim() !== '') queryParts.push(`search=${encodeURIComponent(search.trim())}`);
    if (after) queryParts.push(`after=${encodeURIComponent(after)}`);
    if (before) queryParts.push(`before=${encodeURIComponent(before)}`);

    const queryString = `?${queryParts.join('&')}`;
    const res = await request({
        method: 'GET',
        path: `/agent/orders${queryString}`
    });

    return res;
}

/**
 * Iterate through DataHouse order pages to retrieve full dataset for telecom exports
 *
 * @param {Object} filters
 * @returns {Promise<Array<Object>>}
 */
async function fetchAllOrdersForExport(filters = {}) {
    const allOrders = [];
    let page = 1;
    const limit = 100; // DataHouse max page limit
    let hasMore = true;

    while (hasMore && page <= 50) { // Max safety bound 5,000 orders
        const res = await listOrders({ ...filters, page, limit });
        if (!res.ok) {
            console.error(`⚠️ [DataHouse Export] Failed fetching page ${page}:`, res.error);
            break;
        }

        const items = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.items || res.data?.orders || []);
        if (items.length === 0) {
            hasMore = false;
            break;
        }

        allOrders.push(...items);

        const total = res.data?.meta?.total ?? res.meta?.total ?? items.length;
        if (allOrders.length >= total || items.length === 0) {
            hasMore = false;
        } else {
            page++;
        }
    }

    return allOrders;
}

module.exports = {
    createSingleOrder,
    createBulkOrder,
    getOrderById,
    listOrders,
    fetchAllOrdersForExport
};
