const datahouse = require('../integrations/datahouse');

/**
 * Legacy Adapter for DataHouse Integration
 * All telecom order sourcing routes exclusively to DataHouse.
 */

const getSourcingConfig = async () => {
    return {
        active_sourcing_api: 'datahouse',
        datahouse_api_key: process.env.DATAHOUSE_API_KEY || '',
        providers: {
            datahouse: {
                slug: 'datahouse',
                name: 'GetMorePayLess DataHouse',
                provider_type: 'builtin',
                base_url: process.env.DATAHOUSE_API_BASE_URL || 'https://api.getmorepaylessdatahouse.net/api/v1',
                api_key: process.env.DATAHOUSE_API_KEY || '',
                is_active: true
            }
        }
    };
};

const placeDataOrder = async ({ network, dataAmount, recipientPhone, transactionId, bundleId }) => {
    // 1. Resolve bundle if not provided
    let resolvedBundleId = bundleId;
    if (!resolvedBundleId) {
        const bundlesRes = await datahouse.getBundles({ network: network?.toUpperCase(), limit: 100 });
        if (bundlesRes.ok && bundlesRes.bundles.length > 0) {
            // Find match by data amount
            const match = bundlesRes.bundles.find(b => 
                b.dataVolume === dataAmount || 
                String(b.dataSizeGb) === String(dataAmount).replace(/[^0-9.]/g, '')
            ) || bundlesRes.bundles[0];
            resolvedBundleId = match.id;
        }
    }

    const res = await datahouse.createSingleOrder({
        bundleId: resolvedBundleId,
        phoneNumber: recipientPhone,
        idempotencyKey: transactionId
    });

    if (res.ok) {
        const d = res.data || {};
        return {
            success: true,
            status: d.status || 'processing',
            message: 'Order accepted by DataHouse',
            orderId: d.id || d.publicId,
            referenceCode: d.referenceCode || d.reference,
            apiResponse: d
        };
    } else {
        const err = datahouse.translateDataHouseError(res.error, res.correlationId);
        return {
            success: false,
            status: 'failed',
            error: err.message,
            message: err.message,
            code: err.code,
            apiResponse: res.error
        };
    }
};

const checkOrderStatus = async (orderIdOrReference) => {
    const res = await datahouse.getOrderById(orderIdOrReference);
    if (res.ok) {
        const d = res.data || {};
        return {
            success: true,
            status: d.status || 'processing',
            portalStatus: d.status,
            order: d
        };
    }
    return {
        success: false,
        error: res.error?.message || 'Failed to check order status with DataHouse'
    };
};

const checkBalance = async () => {
    const res = await datahouse.getWalletBalance();
    if (res.ok) {
        return {
            success: true,
            balance: res.balance,
            currency: res.currency
        };
    }
    return {
        success: false,
        error: res.error?.message || 'Failed to check wallet balance'
    };
};

const extractProviderId = (apiResponse, fallbackId) => {
    if (!apiResponse) return fallbackId;
    let data = apiResponse;
    try {
        if (typeof apiResponse === 'string') data = JSON.parse(apiResponse);
    } catch {}
    return data?.id || data?.publicId || data?.order_id || data?.data?.id || data?.data?.publicId || fallbackId;
};

module.exports = {
    getSourcingConfig,
    placeDataOrder,
    checkOrderStatus,
    checkBalance,
    extractProviderId
};
