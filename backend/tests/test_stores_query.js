const pool = require('../config/database');

async function testStoresQuery() {
    try {
        const [stores] = await pool.execute(`
            SELECT s.*, 
                   COALESCE(p.full_name, p.email, u.email) as owner_name,
                   COALESCE(p.email, u.email) as owner_email,
                   COALESCE(w.total_profit_earned, 0.00) as total_profit_earned,
                   (SELECT COUNT(*)::integer FROM agent_orders WHERE store_id = s.id) as total_orders
            FROM agent_stores s
            LEFT JOIN users u ON s.user_id = u.uuid
            LEFT JOIN profiles p ON s.user_id = p.id
            LEFT JOIN agent_wallets w ON s.user_id = w.agent_id
            ORDER BY s.created_at DESC
        `);
        console.log('Stores query succeeded! Found:', stores.length);
        if (stores.length > 0) {
            console.log('Sample store:', stores[0]);
        }
    } catch (e) {
        console.error('Stores query failed:', e.message);
    }
    process.exit(0);
}

testStoresQuery();
