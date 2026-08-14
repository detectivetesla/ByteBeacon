const pool = require('../config/database');

async function inspectDb() {
    console.log('--- Inspecting datahouse_webhook_logs ---');
    try {
        const [cols] = await pool.execute(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'datahouse_webhook_logs'
        `);
        console.log('datahouse_webhook_logs columns:', cols.map(c => `${c.column_name} (${c.data_type})`));
    } catch (e) {
        console.error('Error inspecting webhook logs:', e.message);
    }

    console.log('\n--- Inspecting data_bundles ---');
    try {
        const [bundles] = await pool.execute('SELECT id, network, data_amount, price_ghc, agent_price_ghc FROM data_bundles LIMIT 5');
        console.log('Sample data_bundles:', bundles);
    } catch (e) {
        console.error('Error inspecting bundles:', e.message);
    }

    process.exit(0);
}

inspectDb();
