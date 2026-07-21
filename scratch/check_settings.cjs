require('dotenv').config({ path: './backend/.env' });
const pool = require('./backend/config/database');

async function checkSettings() {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM system_settings'
        );
        console.log('SYSTEM_SETTINGS:', JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        process.exit();
    }
}

checkSettings();
