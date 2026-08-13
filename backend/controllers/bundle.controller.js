const { getBundles, getBundleById: getDhBundleById } = require('../integrations/datahouse');
const pool = require('../config/database');

/**
 * Bundle Catalog Controller
 * DataHouse is the sole source of truth for bundles, sizes, network types, and effective agent prices.
 */

// Get all bundles
const getAllBundles = async (req, res) => {
    try {
        const userId = req.user?.id;
        const isAgent = req.user?.role === 'agent' || req.user?.role === 'superagent';

        // Fetch authoritative bundles from DataHouse
        const dhRes = await getBundles({ limit: 100 });
        let bundles = dhRes.bundles || [];

        // If DataHouse returns bundles, present them
        if (bundles.length > 0) {
            const formatted = bundles.map(b => {
                const effectiveAgentPrice = b.agentAmount || b.amount;
                const standardPrice = b.amount || effectiveAgentPrice;
                const userPrice = isAgent ? effectiveAgentPrice : standardPrice;

                return {
                    id: b.id,
                    network: b.network,
                    dataAmount: b.dataVolume,
                    dataSizeGb: b.dataSizeGb,
                    priceGhc: standardPrice,
                    agentPrice: isAgent ? effectiveAgentPrice : null,
                    userPrice: userPrice,
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

        const formatted = dbBundles.map(b => ({
            id: b.id,
            network: b.network,
            dataAmount: b.data_amount,
            priceGhc: parseFloat(b.price_ghc),
            agentPrice: isAgent ? parseFloat(b.agent_price_ghc || b.price_ghc) : null,
            userPrice: parseFloat(b.price_ghc),
            isActive: b.is_active
        }));

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
        const isAgent = req.user?.role === 'agent' || req.user?.role === 'superagent';

        const dhRes = await getBundles({ network: networkUpper, limit: 100 });
        let bundles = dhRes.bundles || [];

        if (bundles.length > 0) {
            const formatted = bundles.map(b => {
                const effectiveAgentPrice = b.agentAmount || b.amount;
                const standardPrice = b.amount || effectiveAgentPrice;
                const userPrice = isAgent ? effectiveAgentPrice : standardPrice;

                return {
                    id: b.id,
                    network: b.network,
                    dataAmount: b.dataVolume,
                    dataSizeGb: b.dataSizeGb,
                    priceGhc: standardPrice,
                    agentPrice: isAgent ? effectiveAgentPrice : null,
                    userPrice: userPrice,
                    isActive: b.isActive,
                    validity: b.validity
                };
            });

            return res.json(formatted);
        }

        // Fallback to local database cache
        const [dbBundles] = await pool.execute(
            'SELECT * FROM data_bundles WHERE network = ? AND is_active = true ORDER BY price_ghc',
            [networkUpper]
        );

        const formatted = dbBundles.map(b => ({
            id: b.id,
            network: b.network,
            dataAmount: b.data_amount,
            priceGhc: parseFloat(b.price_ghc),
            agentPrice: isAgent ? parseFloat(b.agent_price_ghc || b.price_ghc) : null,
            userPrice: parseFloat(b.price_ghc),
            isActive: b.is_active
        }));

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
        const dhBundle = await getDhBundleById(id);

        if (dhBundle) {
            return res.json({
                id: dhBundle.id,
                network: dhBundle.network,
                dataAmount: dhBundle.dataVolume,
                priceGhc: dhBundle.amount,
                agentPrice: dhBundle.agentAmount,
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
        res.json({
            id: b.id,
            network: b.network,
            dataAmount: b.data_amount,
            priceGhc: parseFloat(b.price_ghc),
            agentPrice: parseFloat(b.agent_price_ghc || b.price_ghc),
            isActive: b.is_active
        });
    } catch (error) {
        console.error('Get bundle error:', error);
        res.status(500).json({ error: 'Failed to get bundle' });
    }
};

module.exports = { getAllBundles, getBundlesByNetwork, getBundleById };
