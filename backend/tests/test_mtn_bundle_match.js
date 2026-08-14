const pool = require('../config/database');
const { getDhBundleById } = require('../integrations/datahouse');

async function testBundleMatch() {
    const [rows] = await pool.execute('SELECT id, network, data_amount, price_ghc FROM data_bundles WHERE network = \'MTN\' LIMIT 5');
    console.log('MTN data_bundles from DB:', rows);
    for (const r of rows) {
        const dhB = await getDhBundleById(r.id);
        console.log(`Bundle ID ${r.id} (${r.network} ${r.data_amount}) -> DataHouse Bundle:`, dhB ? `FOUND (${dhB.id}, ${dhB.name}, cost: ${dhB.agentAmount})` : 'NOT FOUND');
    }
    process.exit(0);
}

testBundleMatch();
