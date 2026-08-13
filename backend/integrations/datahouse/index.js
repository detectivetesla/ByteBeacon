const client = require('./client');
const bundles = require('./bundles');
const orders = require('./orders');
const beneficiaries = require('./beneficiaries');
const wallet = require('./wallet');
const webhooks = require('./webhooks');
const errors = require('./errors');

/**
 * Unified DataHouse Integration Layer for ByteBeacon
 *
 * Architecture Rule:
 * ByteBeacon is the presentation, authentication, proxy, and synchronization layer.
 * DataHouse is the sole authority for telecom products, pricing, orders, and lifecycle states.
 */

module.exports = {
    client,
    bundles,
    orders,
    beneficiaries,
    wallet,
    webhooks,
    errors,

    // Top-level conveniences
    createSingleOrder: orders.createSingleOrder,
    createBulkOrder: orders.createBulkOrder,
    getOrderById: orders.getOrderById,
    listOrders: orders.listOrders,
    fetchAllOrdersForExport: orders.fetchAllOrdersForExport,

    getBundles: bundles.getBundles,
    getBundleById: bundles.getBundleById,

    precheckBeneficiaries: beneficiaries.precheckBeneficiaries,
    listBeneficiaries: beneficiaries.listBeneficiaries,

    getWalletBalance: wallet.getWalletBalance,
    getWalletLedger: wallet.getWalletLedger,

    verifyWebhookSignature: webhooks.verifyWebhookSignature,
    extractDeliveryId: webhooks.extractDeliveryId,
    isDuplicateDelivery: webhooks.isDuplicateDelivery,
    recordWebhookEvent: webhooks.recordWebhookEvent,
    getAgentProfile: client.getAgentProfile,
    normalizePhone: bundles.normalizePhone,

    translateDataHouseError: errors.translateDataHouseError
};
