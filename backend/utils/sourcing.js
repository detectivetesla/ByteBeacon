const pool = require('../config/database');
const portal02 = require('./portal02');
const datahouse = require('./datahouse');

/**
 * Fetch dynamic configuration from sourcing_providers table
 */
const getSourcingConfig = async () => {
    try {
        const [rows] = await pool.execute(
            "SELECT slug, name, provider_type, base_url, api_key, is_active, config FROM sourcing_providers"
        );
        let active_sourcing_api = 'datahouse';
        let portal02_api_key = process.env.PORTAL02_API_KEY || '';
        let datahouse_api_key = process.env.DATAHOUSE_API_KEY || '';
        const providers = {};

        for (const row of rows) {
            const resolvedApiKey = (row.api_key && row.api_key.trim()) ? row.api_key.trim() : (row.slug === 'portal02' ? portal02_api_key : (row.slug === 'datahouse' ? datahouse_api_key : ''));
            providers[row.slug] = {
                slug: row.slug,
                name: row.name,
                provider_type: row.provider_type,
                base_url: row.base_url,
                api_key: resolvedApiKey,
                is_active: row.is_active,
                config: typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {})
            };
            if (row.is_active) {
                active_sourcing_api = row.slug;
            }
            if (row.slug === 'portal02') {
                portal02_api_key = resolvedApiKey || portal02_api_key;
            }
            if (row.slug === 'datahouse') {
                datahouse_api_key = resolvedApiKey || datahouse_api_key;
            }
        }

        // Fallback for defaults if not seeded
        if (!providers['datahouse']) {
            providers['datahouse'] = { slug: 'datahouse', name: 'GetMorePayLess', provider_type: 'builtin', base_url: 'https://api.getmorepaylessdatahouse.net/api/v1', api_key: datahouse_api_key };
        }
        if (!providers['portal02']) {
            providers['portal02'] = { slug: 'portal02', name: 'Portal-02', provider_type: 'builtin', base_url: 'https://www.portal-02.com/api/v1', api_key: portal02_api_key };
        }

        return {
            active_sourcing_api,
            portal02_api_key,
            datahouse_api_key,
            providers
        };
    } catch (e) {
        console.error('Failed to load sourcing config from database, using env fallbacks:', e.message);
        return {
            active_sourcing_api: 'datahouse',
            portal02_api_key: process.env.PORTAL02_API_KEY,
            datahouse_api_key: process.env.DATAHOUSE_API_KEY,
            providers: {
                datahouse: { slug: 'datahouse', name: 'GetMorePayLess', provider_type: 'builtin', base_url: 'https://api.getmorepaylessdatahouse.net/api/v1', api_key: process.env.DATAHOUSE_API_KEY },
                portal02: { slug: 'portal02', name: 'Portal-02', provider_type: 'builtin', base_url: 'https://www.portal-02.com/api/v1', api_key: process.env.PORTAL02_API_KEY }
            }
        };
    }
};

/**
 * Place order using plan-assigned provider or fallback active provider
 */
const placeDataOrderUnified = async ({ network, dataAmount, recipientPhone, transactionId, providerSlug: overrideProviderSlug = null }) => {
    const config = await getSourcingConfig();
    const providerSlug = overrideProviderSlug || config.active_sourcing_api;
    const provider = config.providers[providerSlug] || config.providers[config.active_sourcing_api] || { slug: 'datahouse', provider_type: 'builtin', base_url: '', api_key: '' };
    
    const apiKey = provider.api_key;
    const baseUrl = provider.base_url;
    const providerTemplate = provider.slug === 'portal02' || provider.config?.template === 'portal02' ? 'portal02' : 'datahouse';

    console.log(`📡 [SOURCING] Routing order to ${provider.slug} (template: ${providerTemplate}, url: ${baseUrl})...`);

    let fulfillment;
    if (providerTemplate === 'portal02') {
        fulfillment = await portal02.placeDataOrder({ network, dataAmount, recipientPhone, transactionId, apiKey, baseUrl });
    } else {
        fulfillment = await datahouse.placeDataOrder({ network, dataAmount, recipientPhone, transactionId, apiKey, baseUrl });
    }

    if (fulfillment) {
        if (!fulfillment.apiResponse) {
            fulfillment.apiResponse = {};
        }
        // Explicitly inject the provider name and template to the apiResponse metadata
        fulfillment.apiResponse.provider = provider.slug;
        fulfillment.apiResponse.template = providerTemplate;
    }
    return fulfillment;
};

/**
 * Check order status from the correct provider
 */
const checkOrderStatusUnified = async (orderIdOrReference, providerName) => {
    const config = await getSourcingConfig();
    const providerSlug = providerName || config.active_sourcing_api;
    const provider = config.providers[providerSlug] || { slug: 'datahouse', provider_type: 'builtin', base_url: '', api_key: '' };
    
    const apiKey = provider.api_key;
    const baseUrl = provider.base_url;
    const providerTemplate = provider.slug === 'portal02' || provider.config?.template === 'portal02' ? 'portal02' : 'datahouse';

    console.log(`🔍 [SOURCING] Checking status with ${provider.slug} (template: ${providerTemplate})...`);

    if (providerTemplate === 'portal02') {
        return await portal02.checkOrderStatus(orderIdOrReference, apiKey, baseUrl);
    } else {
        return await datahouse.checkOrderStatus(orderIdOrReference, apiKey, baseUrl);
    }
};

/**
 * Check balance for the correct provider
 */
const checkBalanceUnified = async (providerName) => {
    const config = await getSourcingConfig();
    const providerSlug = providerName || config.active_sourcing_api;
    const provider = config.providers[providerSlug] || { slug: 'datahouse', provider_type: 'builtin', base_url: '', api_key: '' };
    
    const apiKey = provider.api_key;
    const baseUrl = provider.base_url;
    const providerTemplate = provider.slug === 'portal02' || provider.config?.template === 'portal02' ? 'portal02' : 'datahouse';

    if (providerTemplate === 'portal02') {
        return await portal02.checkBalance(apiKey, baseUrl);
    } else {
        return await datahouse.checkBalance(apiKey, baseUrl);
    }
};

/**
 * Extract provider ID using appropriate extractor
 */
const extractProviderIdUnified = (apiResponse, fallbackId, targetPhone, providerName) => {
    if (!apiResponse) return fallbackId;

    let data = apiResponse;
    try {
        if (typeof apiResponse === 'string') {
            data = JSON.parse(apiResponse);
        }
    } catch (e) {}

    // Find provider metadata and template in response
    const providerSlug = providerName || data?.provider || (data?.portal02_webhook ? 'portal02' : (data?.datahouse_webhook ? 'datahouse' : null));
    const providerTemplate = data?.template || (providerSlug === 'portal02' ? 'portal02' : 'datahouse');

    if (providerTemplate === 'portal02') {
        return portal02.extractProviderId(apiResponse, fallbackId, targetPhone);
    } else if (providerTemplate === 'datahouse') {
        return datahouse.extractProviderId(apiResponse, fallbackId, targetPhone);
    } else {
        // Fallback: try both extractors
        const idDH = datahouse.extractProviderId(apiResponse, fallbackId, targetPhone);
        if (idDH !== fallbackId) return idDH;
        return portal02.extractProviderId(apiResponse, fallbackId, targetPhone);
    }
};

module.exports = {
    getSourcingConfig,
    placeDataOrder: placeDataOrderUnified,
    checkOrderStatus: checkOrderStatusUnified,
    checkBalance: checkBalanceUnified,
    extractProviderId: extractProviderIdUnified
};

