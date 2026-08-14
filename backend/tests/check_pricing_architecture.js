const pool = require('../config/database');
const { getBundles } = require('../integrations/datahouse');

async function check() {
    try {
        console.log('--- Checking agent_pricing table schema ---');
        const [apCols] = await pool.execute(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agent_pricing'"
        );
        console.log('agent_pricing columns:', apCols);

        console.log('\n--- Checking data_bundles table schema ---');
        const [dbCols] = await pool.execute(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'data_bundles'"
        );
        console.log('data_bundles columns:', dbCols);

        console.log('\n--- Sample data_bundles rows in DB ---');
        const [dbRows] = await pool.execute(
            "SELECT id, network, data_amount, price_ghc, agent_price_ghc, is_active FROM data_bundles LIMIT 5"
        );
        console.log('data_bundles rows:', dbRows);

        console.log('\n--- Sample DataHouse bundles ---');
        const dh = await getBundles({ limit: 5 });
        console.log('DataHouse bundles:', dh.bundles ? dh.bundles.slice(0, 3) : dh);

        console.log('\n--- Sample agent_pricing rows ---');
        const [apRows] = await pool.execute(
            "SELECT * FROM agent_pricing LIMIT 5"
        );
        console.log('agent_pricing rows:', apRows);

    } catch (e) {
        console.error('Check error:', e);
    } finally {
        process.exit(0);
    }
}

check();
