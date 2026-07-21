const pool = require('../config/database');

// Get all bundles
const getAllBundles = async (req, res) => {
    try {
        const userId = req.user?.id;
        const isAgent = req.user?.role === 'agent';

        const [bundles] = await pool.execute(`
            SELECT b.*, ap.custom_price
            FROM data_bundles b
            LEFT JOIN agent_pricing ap ON b.id = ap.bundle_id AND ap.agent_id = ?::uuid
            WHERE b.is_active = true 
            ORDER BY b.network, b.price_ghc
        `, [userId || null]);

        const formattedBundles = bundles.map(b => {
            const priceGhc = parseFloat(b.price_ghc);
            const agentPriceGhc = parseFloat(b.agent_price_ghc || b.price_ghc);
            const customPrice = b.custom_price ? parseFloat(b.custom_price) : null;

            // Determine final price for this user
            let userPrice = priceGhc;
            if (customPrice !== null) {
                userPrice = customPrice;
            } else if (isAgent) {
                userPrice = agentPriceGhc;
            }

            return {
                id: b.id,
                network: b.network,
                dataAmount: b.data_amount,
                priceGhc: priceGhc,
                agentPrice: isAgent ? agentPriceGhc : null,
                userPrice: userPrice, // The actual price this user pays
                isActive: b.is_active,
                createdAt: b.created_at
            };
        });

        res.json(formattedBundles);

    } catch (error) {
        console.error('Get bundles error:', error);
        res.status(500).json({ error: 'Failed to get bundles' });
    }
};

// Get bundles by network
const getBundlesByNetwork = async (req, res) => {
    try {
        const { network } = req.params;
        const networkUpper = network.toUpperCase();
        const userId = req.user?.id;
        const isAgent = req.user?.role === 'agent';

        const [bundles] = await pool.execute(`
            SELECT b.*, ap.custom_price
            FROM data_bundles b
            LEFT JOIN agent_pricing ap ON b.id = ap.bundle_id AND ap.agent_id = ?::uuid
            WHERE b.network = ? AND b.is_active = true 
            ORDER BY b.price_ghc
        `, [userId || null, networkUpper]);

        const formattedBundles = bundles.map(b => {
            const priceGhc = parseFloat(b.price_ghc);
            const agentPriceGhc = parseFloat(b.agent_price_ghc || b.price_ghc);
            const customPrice = b.custom_price ? parseFloat(b.custom_price) : null;

            // Determine final price for this user
            let userPrice = priceGhc;
            if (customPrice !== null) {
                userPrice = customPrice;
            } else if (isAgent) {
                userPrice = agentPriceGhc;
            }

            return {
                id: b.id,
                network: b.network,
                dataAmount: b.data_amount,
                priceGhc: priceGhc,
                agentPrice: isAgent ? agentPriceGhc : null,
                userPrice: userPrice, // The actual price this user pays
                isActive: b.is_active,
                createdAt: b.created_at
            };
        });

        res.json(formattedBundles);

    } catch (error) {
        console.error('Get bundles by network error:', error);
        res.status(500).json({ error: 'Failed to get bundles' });
    }
};

// Get single bundle
const getBundleById = async (req, res) => {
    try {
        const { id } = req.params;

        const [bundles] = await pool.execute(
            'SELECT id, network, data_amount, price_ghc, is_active, created_at FROM data_bundles WHERE id = ?::uuid',
            [id]
        );

        if (bundles.length === 0) {
            return res.status(404).json({ error: 'Bundle not found' });
        }

        const b = bundles[0];
        res.json({
            id: b.id,
            network: b.network,
            dataAmount: b.data_amount,
            priceGhc: parseFloat(b.price_ghc),
            isActive: b.is_active,
            createdAt: b.created_at
        });

    } catch (error) {
        console.error('Get bundle error:', error);
        res.status(500).json({ error: 'Failed to get bundle' });
    }
};

module.exports = { getAllBundles, getBundlesByNetwork, getBundleById };
