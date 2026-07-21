require('dotenv').config({ path: './backend/.env' });
const pool = require('./backend/config/database');

async function checkTx() {
    try {
        const [rows] = await pool.execute(
            'SELECT id, recipient_phone, status, api_response FROM transactions WHERE id = ?::uuid',
            ['ffbc0742-3b37-4cb9-a5f9-34757a20d485']
        );
        console.log('TRANS_DATA:', JSON.stringify(rows[0], null, 2));
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        process.exit();
    }
}

checkTx();
