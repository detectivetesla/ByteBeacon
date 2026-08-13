const { request } = require('./client');
const { normalizePhone } = require('./bundles');

/**
 * DataHouse Authoritative Beneficiaries & MTN Precheck Integration
 * DataHouse owns MTN Up2U validation, known beneficiary status, and approval lifecycles.
 */

/**
 * Perform bulk-sized beneficiary precheck with DataHouse (POST /agent/beneficiaries/precheck)
 *
 * @param {Object} params
 * @param {string} [params.network='MTN'] - 'MTN' | 'TELECEL'
 * @param {Array<string>|string} params.phoneNumbers - Phone number(s) to check (1–1000)
 * @param {boolean} [params.record=false] - If true, records unknown MTN numbers for approval
 * @param {boolean} [params.enforce=true] - Backward compatibility alias for record
 * @returns {Promise<{ ok: boolean, results: Array<Object>, summary?: Object, unknown?: Array<string>, error?: any }>}
 */
async function precheckBeneficiaries({ network = 'MTN', phoneNumbers, record = false, enforce = true }) {
    const rawList = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];
    const cleanList = rawList.map(normalizePhone).filter(Boolean);

    if (cleanList.length === 0) {
        return { ok: false, results: [], error: { code: 'INVALID_PHONE', message: 'No valid phone numbers provided' } };
    }

    const isRecord = Boolean(record || enforce);
    const payload = {
        network: (network || 'MTN').toUpperCase(),
        phoneNumbers: cleanList,
        record: isRecord
    };

    console.log(`🔍 [DataHouse Beneficiaries] Prechecking ${cleanList.length} numbers for ${payload.network} (record: ${isRecord})...`);

    const res = await request({
        method: 'POST',
        path: '/agent/beneficiaries/precheck',
        body: payload
    });

    if (!res.ok) {
        return {
            ok: false,
            results: [],
            error: res.error
        };
    }

    const d = res.data || {};
    const rawResults = Array.isArray(d) ? d : (d.results || d.data || []);
    return {
        ok: true,
        network: d.network || payload.network,
        enforced: d.enforced !== undefined ? d.enforced : true,
        sandbox: Boolean(d.sandbox),
        recorded: Boolean(d.recorded),
        summary: d.summary || {},
        unknown: d.unknown || [],
        results: rawResults
    };
}

/**
 * List authoritative beneficiary records from DataHouse (GET /agent/beneficiaries)
 *
 * @param {Object} [params]
 * @param {string} [params.status] - 'pending' | 'submitted' | 'approved' | 'rejected'
 * @param {string} [params.network] - 'MTN' | 'TELECEL'
 * @param {string} [params.search] - Substring search on phone number digits
 * @param {number} [params.page=1]
 * @param {number} [params.limit=30] - Max 100
 * @returns {Promise<{ ok: boolean, data?: any, meta?: any, error?: any }>}
 */
async function listBeneficiaries(params = {}) {
    const {
        status,
        network,
        search,
        page = 1,
        limit = 30
    } = params;

    const queryParts = [
        `page=${Math.max(1, parseInt(page, 10) || 1)}`,
        `limit=${Math.min(100, Math.max(1, parseInt(limit, 10) || 30))}`
    ];

    if (status && status !== 'all') queryParts.push(`status=${encodeURIComponent(status)}`);
    if (network && network !== 'all') queryParts.push(`network=${encodeURIComponent(network.toUpperCase())}`);
    if (search && search.trim() !== '') queryParts.push(`search=${encodeURIComponent(search.trim())}`);

    const queryString = `?${queryParts.join('&')}`;
    const res = await request({
        method: 'GET',
        path: `/agent/beneficiaries${queryString}`
    });

    return res;
}

module.exports = {
    precheckBeneficiaries,
    listBeneficiaries
};
