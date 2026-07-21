const { Pool } = require('pg');

// Helper to escape password components
const encode = (str) => str ? encodeURIComponent(str) : '';

// Build connection string from various sources (Manual, VITE, or Official Integrations)
// Priority: 1. Official Pooler URL, 2. Manual DATABASE_URL, 3. Derived from Project ID
// Build connection string from various sources
let rawConnectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
let connectionString = rawConnectionString;

// Validation: If it's a web URL (https), we extract the project ID
if (connectionString && connectionString.startsWith('https')) {
    const match = connectionString.match(/https:\/\/([a-z0-9]+)\.supabase/);
    if (match) {
        process.env.SUPABASE_PROJECT_ID = match[1];
        connectionString = null; // Re-derive properly
    }
}

if (!connectionString) {
    const projectId = process.env.SUPABASE_PROJECT_ID || process.env.VITE_SUPABASE_PROJECT_ID || 'zlcdhksjnaglrlkcrujr';
    const dbPass = process.env.DB_PASSWORD || process.env.VITE_DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'UwxZD6pXiRuBEBeN';

    if (projectId) {
        // Automatically derive hostname from Supabase Project ID
        // Using the EXACT regional Pooler Host provided by the user for stability
        const host = 'aws-1-us-east-1.pooler.supabase.com';
        const user = `postgres.${projectId}`;
        const pass = encode(dbPass);
        const name = 'postgres';
        const port = '6543';
        connectionString = `postgresql://${user}:${pass}@${host}:${port}/${name}?pgbouncer=true`;
        console.log(`🛠️ Derived connection using regional Supabase Pooler: ${host} (Port 6543)`);
    } else if (process.env.DB_HOST) {
        const user = process.env.DB_USER || 'postgres';
        const pass = encode(dbPass);
        const host = process.env.DB_HOST;
        const port = process.env.DB_PORT || '5432';
        const name = process.env.DB_NAME || 'postgres';
        connectionString = `postgresql://${user}:${pass}@${host}:${port}/${name}`;
    }
}

// Strip conflicting SSL parameters from the string (we handle them in the Pool options)
if (connectionString && typeof connectionString === 'string') {
    connectionString = connectionString.split('?')[0] + (connectionString.includes('?') ? '?pgbouncer=true' : '');
}

// Create connection pool
const isCloud = connectionString && (
    connectionString.includes('supabase.co') ||
    connectionString.includes('supabase.com') ||
    connectionString.includes('pooler.supabase')
);

// FOR SUPABASE: We MUST disable unauthorized cert rejection for the pooler to work on Vercel
const sslConfig = (process.env.NODE_ENV === 'production' || isCloud)
    ? { rejectUnauthorized: false }
    : false;

const pool = new Pool({
    connectionString: connectionString,
    ssl: sslConfig,
    max: 10, // Reduced for serverless
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
});

// Pool error handling
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

// Test connection (only call when needed)
const testConnection = async () => {
    if (!process.env.DATABASE_URL) return;
    try {
        const client = await pool.connect();
        console.log('✅ PostgreSQL Database connected successfully');
        client.release();
    } catch (error) {
        if (error.code === 'ENOTFOUND') {
            console.error('❌ PostgreSQL Connection Error: DNS resolution failed.');
            console.error('💡 TIP: If you are using Supabase on Vercel, try using the "Connection Pooler" URL (port 6543) instead of the Direct Connection URL.');
        } else {
            console.error('❌ PostgreSQL Connection Error:', error.message);
        }
    }
};

module.exports = {
    execute: async (text, params) => {
        let index = 1;
        const pgText = typeof text === 'string' ? text.replace(/\?/g, () => `$${index++}`) : text;
        try {
            const res = await pool.query(pgText, params);
            // If it's not a SELECT query, return a result header like mysql2
            if (res.command !== 'SELECT') {
                return [{
                    affectedRows: res.rowCount,
                    insertId: res.rows[0]?.id || null, // Best effort for insertId
                    warningStatus: 0,
                    serverStatus: 2,
                    changedRows: res.rowCount
                }, res.fields];
            }
            return [res.rows, res.fields];
        } catch (error) {
            console.error('Database Execute Error:', error.message);
            throw error;
        }
    },
    getConnection: async () => {
        const client = await pool.connect();

        // Check if connection is dead
        if (!client) throw new Error('Failed to acquire connection from pool');

        // Mock mysql2 connection methods
        const originalQuery = client.query.bind(client);

        client.execute = async (text, params) => {
            let index = 1;
            const pgText = typeof text === 'string' ? text.replace(/\?/g, () => `$${index++}`) : text;
            const res = await originalQuery(pgText, params);

            if (res.command !== 'SELECT') {
                return [{
                    affectedRows: res.rowCount,
                    insertId: res.rows[0]?.id || null,
                    warningStatus: 0,
                    serverStatus: 2,
                    changedRows: res.rowCount
                }, res.fields];
            }
            return [res.rows, res.fields];
        };

        client.beginTransaction = () => originalQuery('BEGIN');
        client.commit = () => originalQuery('COMMIT');
        client.rollback = () => originalQuery('ROLLBACK');

        return client;
    },
    query: (text, params) => pool.query(text, params),
    pool
};
