const pool = require('../config/database');

async function testProfilesColumn() {
    try {
        const [rows] = await pool.execute(
            `SELECT column_name, data_type 
             FROM information_schema.columns 
             WHERE table_name = 'profiles' AND column_name = 'last_seen_mtn_at'`
        );
        console.log('last_seen_mtn_at column exists in profiles:', rows.length > 0);
        if (rows.length === 0) {
            console.log('Adding last_seen_mtn_at to profiles...');
            await pool.execute('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_mtn_at TIMESTAMPTZ DEFAULT NULL');
            console.log('Added last_seen_mtn_at column to profiles successfully.');
        }
    } catch (e) {
        console.error('Error checking/adding last_seen_mtn_at:', e.message);
    }
    process.exit(0);
}

testProfilesColumn();
