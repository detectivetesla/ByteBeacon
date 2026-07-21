const pool = require('../backend/config/database');

async function checkTx() {
    try {
        const query = `
            SELECT id, recipient_phone, amount_ghc, status, created_at, updated_at, 
                   serial_id, balance_before, balance_after, source, paid, source_provider, 
                   api_response, failure_reason
            FROM transactions 
            WHERE id::text LIKE '%TXN-6E9ABDA72C2E%' 
               OR api_response::text LIKE '%TXN-6E9ABDA72C2E%' 
               OR failure_reason LIKE '%TXN-6E9ABDA72C2E%'
        `;
        const [rows] = await pool.execute(query);
        console.log('--- FOUND TRANSACTIONS ---');
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error('Error querying:', e);
    } finally {
        await pool.end();
    }
}

checkTx();
