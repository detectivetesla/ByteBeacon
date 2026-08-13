const { request } = require('./client');

/**
 * DataHouse Authoritative Agent Wallet Integration
 * DataHouse owns carrier wallet balance, overdrafts, and telecom purchase ledger.
 */

/**
 * Fetch DataHouse telecom agent wallet balance (GET /agent/wallet/balance)
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   balance?: number,
 *   currency?: string,
 *   overdraftLimit?: number,
 *   overdraftUsed?: number,
 *   overdraftAvailable?: number,
 *   overdraftActive?: boolean,
 *   availableToSpend?: number,
 *   data?: Object,
 *   error?: any
 * }>}
 */
async function getWalletBalance() {
    const res = await request({
        method: 'GET',
        path: '/agent/wallet/balance'
    });

    if (!res.ok) {
        return { ok: false, error: res.error };
    }

    const d = res.data || {};
    const balance = parseFloat(d.balance !== undefined ? d.balance : 0);
    const currency = d.currency || 'GHS';
    const overdraftLimit = parseFloat(d.overdraftLimit !== undefined ? d.overdraftLimit : 0);
    const overdraftUsed = parseFloat(d.overdraftUsed !== undefined ? d.overdraftUsed : 0);
    const overdraftAvailable = parseFloat(d.overdraftAvailable !== undefined ? d.overdraftAvailable : 0);
    const overdraftActive = Boolean(d.overdraftActive);
    const availableToSpend = parseFloat(d.availableToSpend !== undefined ? d.availableToSpend : (balance + overdraftAvailable));

    return {
        ok: true,
        balance,
        currency,
        overdraftLimit,
        overdraftUsed,
        overdraftAvailable,
        overdraftActive,
        availableToSpend,
        data: d,
        raw: d
    };
}

/**
 * Fetch DataHouse telecom agent wallet ledger (GET /agent/wallet/ledger)
 *
 * @returns {Promise<{ ok: boolean, data?: Object, ledger: Array<Object>, meta?: Object, error?: any }>}
 */
async function getWalletLedger() {
    const res = await request({
        method: 'GET',
        path: '/agent/wallet/ledger'
    });

    if (!res.ok) {
        return { ok: false, ledger: [], error: res.error };
    }

    const items = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    const meta = res.data?.meta || res.meta || { page: 1, limit: 50, total: items.length };

    return {
        ok: true,
        ledger: items,
        data: res.data,
        meta
    };
}

module.exports = {
    getWalletBalance,
    getWalletLedger
};
