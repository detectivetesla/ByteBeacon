const { getBundles, getBundleById: getDhBundleById } = require('../integrations/datahouse');
const pool = require('../config/database');

/**
 * Helper to fetch custom pricing map for a given user
 */
async function getUserCustomPricingMap(userId) {
    if (!userId) return { byBundleId: {}, byNetworkData: {} };

    try {
        const [rows] = await pool.execute(`
            SELECT ap.bundle_id::text as bundle_id, ap.custom_price, db.network, db.data_amount
            FROM agent_pricing ap
            LEFT JOIN data_bundles db ON ap.bundle_id = db.id
            WHERE ap.agent_id = ?::uuid
        `, [userId]);

        const byBundleId = {};
        const byNetworkData = {};

        for (const r of rows) {
            const price = parseFloat(r.custom_price);
            if (r.bundle_id) {
                byBundleId[r.bundle_id.toLowerCase()] = price;
            }
            if (r.network && r.data_amount) {
                const key = `${r.network.trim().toUpperCase()}_${r.data_amount.trim().toUpperCase()}`;
                byNetworkData[key] = price;
            }
        }

        return { byBundleId, byNetworkData };
    } catch (err) {
        console.error('Error fetching user custom pricing:', err.message);
        return { byBundleId: {}, byNetworkData: {} };
    }
}

/**
 * Bundle Catalog Controller
 * DataHouse is the telecom provider. ByteBeacon respects server-side individual user pricing overrides.
 */

// Get all bundles
const getAllBundles = async (req, res) => {
    try {
        const userId = req.user?.id;
        const isAgent = req.user?.role === 'agent' || req.user?.role === 'superagent';

        // Load custom pricing for this user
        const { byBundleId, byNetworkData } = await getUserCustomPricingMap(userId);

        // Fetch authoritative bundles from DataHouse
        const dhRes = await getBundles({ limit: 100 });
        let bundles = dhRes.bundles || [];

        // If DataHouse returns bundles, present them with user custom prices applied
        if (bundles.length > 0) {
            const formatted = bundles.map(b => {
                const bundleIdStr = b.id ? String(b.id).toLowerCase() : '';
                const netKey = `${(b.network || '').trim().toUpperCase()}_${(b.dataVolume || b.dataAmount || '').trim().toUpperCase()}`;

                const customPrice = byBundleId[bundleIdStr] !== undefined
                    ? byBundleId[bundleIdStr]
                    : (byNetworkData[netKey] !== undefined ? byNetworkData[netKey] : null);

                const effectiveAgentPrice = parseFloat(b.agentAmount || b.amount || 0);
                const standardPrice = parseFloat(b.amount || effectiveAgentPrice || 0);
                const defaultUserPrice = isAgent ? effectiveAgentPrice : standardPrice;
                const userPrice = customPrice !== null ? customPrice : defaultUserPrice;

                return {
                    id: b.id,
                    network: b.network,
                    dataAmount: b.dataVolume || b.dataAmount,
                    dataSizeGb: b.dataSizeGb,
                    priceGhc: standardPrice,
                    agentPrice: isAgent ? effectiveAgentPrice : null,
                    userPrice: userPrice,
                    customPrice: customPrice,
                    isActive: b.isActive,
                    validity: b.validity
                };
            });

            return res.json(formatted);
        }

        // Fallback to local database cache if DataHouse is temporarily unreachable
        const [dbBundles] = await pool.execute(`
            SELECT b.*, ap.custom_price
            FROM data_bundles b
            LEFT JOIN agent_pricing ap ON b.id = ap.bundle_id AND ap.agent_id = ?::uuid
            WHERE b.is_active = true 
            ORDER BY b.network, b.price_ghc
        `, [userId || null]);

        const formatted = dbBundles.map(b => {
            const bundleIdStr = b.id ? String(b.id).toLowerCase() : '';
            const netKey = `${(b.network || '').trim().toUpperCase()}_${(b.data_amount || '').trim().toUpperCase()}`;

            let customPrice = b.custom_price ? parseFloat(b.custom_price) : null;
            if (customPrice === null) {
                if (byBundleId[bundleIdStr] !== undefined) customPrice = byBundleId[bundleIdStr];
                else if (byNetworkData[netKey] !== undefined) customPrice = byNetworkData[netKey];
            }

            const standardPrice = parseFloat(b.price_ghc || 0);
            const agentPrice = parseFloat(b.agent_price_ghc || b.price_ghc || 0);
            const defaultUserPrice = isAgent ? agentPrice : standardPrice;
            const userPrice = customPrice !== null ? customPrice : defaultUserPrice;

            return {
                id: b.id,
                network: b.network,
                dataAmount: b.data_amount,
                priceGhc: standardPrice,
                agentPrice: isAgent ? agentPrice : null,
                userPrice: userPrice,
                customPrice: customPrice,
                isActive: b.is_active
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('Get bundles error:', error);
        res.status(500).json({ error: 'Failed to get bundles' });
    }
};

// Get bundles by network
const getBundlesByNetwork = async (req, res) => {
    try {
        const { network } = req.params;
        const networkUpper = (network || '').toUpperCase();
        const userId = req.user?.id;
        const isAgent = req.user?.role === 'agent' || req.user?.role === 'superagent';

        // Load custom pricing for this user
        const { byBundleId, byNetworkData } = await getUserCustomPricingMap(userId);

        const dhRes = await getBundles({ network: networkUpper, limit: 100 });
        let bundles = dhRes.bundles || [];

        if (bundles.length > 0) {
            const formatted = bundles.map(b => {
                const bundleIdStr = b.id ? String(b.id).toLowerCase() : '';
                const netKey = `${(b.network || '').trim().toUpperCase()}_${(b.dataVolume || b.dataAmount || '').trim().toUpperCase()}`;

                const customPrice = byBundleId[bundleIdStr] !== undefined
                    ? byBundleId[bundleIdStr]
                    : (byNetworkData[netKey] !== undefined ? byNetworkData[netKey] : null);

                const effectiveAgentPrice = parseFloat(b.agentAmount || b.amount || 0);
                const standardPrice = parseFloat(b.amount || effectiveAgentPrice || 0);
                const defaultUserPrice = isAgent ? effectiveAgentPrice : standardPrice;
                const userPrice = customPrice !== null ? customPrice : defaultUserPrice;

                return {
                    id: b.id,
                    network: b.network,
                    dataAmount: b.dataVolume || b.dataAmount,
                    dataSizeGb: b.dataSizeGb,
                    priceGhc: standardPrice,
                    agentPrice: isAgent ? effectiveAgentPrice : null,
                    userPrice: userPrice,
                    customPrice: customPrice,
                    isActive: b.isActive,
                    validity: b.validity
                };
            });

            return res.json(formatted);
        }

        // Fallback to local database cache
        const [dbBundles] = await pool.execute(
            `SELECT b.*, ap.custom_price
             FROM data_bundles b
             LEFT JOIN agent_pricing ap ON b.id = ap.bundle_id AND ap.agent_id = ?::uuid
             WHERE UPPER(b.network) = UPPER(?) AND b.is_active = true 
             ORDER BY b.price_ghc`,
            [userId || null, networkUpper]
        );

        const formatted = dbBundles.map(b => {
            const bundleIdStr = b.id ? String(b.id).toLowerCase() : '';
            const netKey = `${(b.network || '').trim().toUpperCase()}_${(b.data_amount || '').trim().toUpperCase()}`;

            let customPrice = b.custom_price ? parseFloat(b.custom_price) : null;
            if (customPrice === null) {
                if (byBundleId[bundleIdStr] !== undefined) customPrice = byBundleId[bundleIdStr];
                else if (byNetworkData[netKey] !== undefined) customPrice = byNetworkData[netKey];
            }

            const standardPrice = parseFloat(b.price_ghc || 0);
            const agentPrice = parseFloat(b.agent_price_ghc || b.price_ghc || 0);
            const defaultUserPrice = isAgent ? agentPrice : standardPrice;
            const userPrice = customPrice !== null ? customPrice : defaultUserPrice;

            return {
                id: b.id,
                network: b.network,
                dataAmount: b.data_amount,
                priceGhc: standardPrice,
                agentPrice: isAgent ? agentPrice : null,
                userPrice: userPrice,
                customPrice: customPrice,
                isActive: b.is_active
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('Get bundles by network error:', error);
        res.status(500).json({ error: 'Failed to get bundles' });
    }
};

// Get single bundle
const getBundleById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const isAgent = req.user?.role === 'agent' || req.user?.role === 'superagent';

        const { byBundleId, byNetworkData } = await getUserCustomPricingMap(userId);
        const dhBundle = await getDhBundleById(id);

        if (dhBundle) {
            const bundleIdStr = dhBundle.id ? String(dhBundle.id).toLowerCase() : '';
            const netKey = `${(dhBundle.network || '').trim().toUpperCase()}_${(dhBundle.dataVolume || dhBundle.dataAmount || '').trim().toUpperCase()}`;

            const customPrice = byBundleId[bundleIdStr] !== undefined
                ? byBundleId[bundleIdStr]
                : (byNetworkData[netKey] !== undefined ? byNetworkData[netKey] : null);

            const effectiveAgentPrice = parseFloat(dhBundle.agentAmount || dhBundle.amount || 0);
            const standardPrice = parseFloat(dhBundle.amount || effectiveAgentPrice || 0);
            const defaultUserPrice = isAgent ? effectiveAgentPrice : standardPrice;
            const userPrice = customPrice !== null ? customPrice : defaultUserPrice;

            return res.json({
                id: dhBundle.id,
                network: dhBundle.network,
                dataAmount: dhBundle.dataVolume || dhBundle.dataAmount,
                priceGhc: standardPrice,
                agentPrice: isAgent ? effectiveAgentPrice : null,
                userPrice: userPrice,
                customPrice: customPrice,
                isActive: dhBundle.isActive,
                validity: dhBundle.validity
            });
        }

        // Fallback to local database
        const [bundles] = await pool.execute(
            'SELECT * FROM data_bundles WHERE id::text = ? OR id::text = ?::uuid',
            [id, id]
        ).catch(async () => {
            return await pool.execute('SELECT * FROM data_bundles WHERE id::text = ?', [id]);
        });

        if (bundles.length === 0) {
            return res.status(404).json({ error: 'Bundle not found' });
        }

        const b = bundles[0];
        const bundleIdStr = b.id ? String(b.id).toLowerCase() : '';
        const netKey = `${(b.network || '').trim().toUpperCase()}_${(b.data_amount || '').trim().toUpperCase()}`;

        const customPrice = byBundleId[bundleIdStr] !== undefined
            ? byBundleId[bundleIdStr]
            : (byNetworkData[netKey] !== undefined ? byNetworkData[netKey] : null);

        const standardPrice = parseFloat(b.price_ghc || 0);
        const agentPrice = parseFloat(b.agent_price_ghc || b.price_ghc || 0);
        const defaultUserPrice = isAgent ? agentPrice : standardPrice;
        const userPrice = customPrice !== null ? customPrice : defaultUserPrice;

        res.json({
            id: b.id,
            network: b.network,
            dataAmount: b.data_amount,
            priceGhc: standardPrice,
            agentPrice: isAgent ? agentPrice : null,
            userPrice: userPrice,
            customPrice: customPrice,
            isActive: b.is_active
        });
    } catch (error) {
        console.error('Get bundle error:', error);
        res.status(500).json({ error: 'Failed to get bundle' });
    }
};

module.exports = { getAllBundles, getBundlesByNetwork, getBundleById };
