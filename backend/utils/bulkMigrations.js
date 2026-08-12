const pool = require('../config/database');

/**
 * Ensure bulk_submissions and bulk_submission_items tables & indexes exist
 */
const initBulkTables = async () => {
    try {
        console.log('🔄 Checking / initializing bulk submission database tables...');

        // 1. bulk_submissions table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS bulk_submissions (
                id UUID PRIMARY KEY,
                public_id VARCHAR(50) UNIQUE NOT NULL,
                reference_code VARCHAR(50) UNIQUE NOT NULL,
                user_id UUID,
                partner_id UUID,
                agent_id UUID,
                network VARCHAR(20),
                data_amount VARCHAR(20),
                bundle_id UUID,
                total_recipients INT NOT NULL DEFAULT 0,
                queued_count INT NOT NULL DEFAULT 0,
                processing_count INT NOT NULL DEFAULT 0,
                completed_count INT NOT NULL DEFAULT 0,
                failed_count INT NOT NULL DEFAULT 0,
                blocked_count INT NOT NULL DEFAULT 0,
                pending_mtn_count INT NOT NULL DEFAULT 0,
                unresolved_count INT NOT NULL DEFAULT 0,
                total_amount_ghc DECIMAL(12,2) DEFAULT 0.00,
                charged_amount_ghc DECIMAL(12,2) DEFAULT 0.00,
                refunded_amount_ghc DECIMAL(12,2) DEFAULT 0.00,
                status VARCHAR(30) NOT NULL DEFAULT 'queued',
                idempotency_key VARCHAR(150) UNIQUE,
                source VARCHAR(50) DEFAULT 'API',
                error_count INT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                started_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ,
                last_progress_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. bulk_submission_items table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS bulk_submission_items (
                id UUID PRIMARY KEY,
                submission_id UUID NOT NULL REFERENCES bulk_submissions(id) ON DELETE CASCADE,
                item_index INT NOT NULL,
                recipient_phone VARCHAR(30) NOT NULL,
                normalized_phone VARCHAR(30) NOT NULL,
                network VARCHAR(20),
                bundle_id UUID,
                bundle_size VARCHAR(20),
                price_ghc DECIMAL(10,2) DEFAULT 0.00,
                status VARCHAR(30) NOT NULL DEFAULT 'queued',
                transaction_id UUID,
                datahouse_reference VARCHAR(100),
                idempotency_key VARCHAR(150) UNIQUE,
                attempt_count INT DEFAULT 0,
                max_attempts INT DEFAULT 5,
                next_retry_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                last_heartbeat_at TIMESTAMPTZ,
                error_code VARCHAR(50),
                error_message TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Create indexes for high-volume performance
        await pool.execute(`CREATE INDEX IF NOT EXISTS idx_bulk_sub_user ON bulk_submissions(user_id, created_at DESC)`);
        await pool.execute(`CREATE INDEX IF NOT EXISTS idx_bulk_sub_status ON bulk_submissions(status)`);
        await pool.execute(`CREATE INDEX IF NOT EXISTS idx_bulk_items_sub_status ON bulk_submission_items(submission_id, status)`);
        await pool.execute(`CREATE INDEX IF NOT EXISTS idx_bulk_items_retry ON bulk_submission_items(status, next_retry_at)`);
        await pool.execute(`CREATE INDEX IF NOT EXISTS idx_bulk_items_phone ON bulk_submission_items(normalized_phone)`);
        await pool.execute(`CREATE INDEX IF NOT EXISTS idx_bulk_items_heartbeat ON bulk_submission_items(status, last_heartbeat_at)`);

        console.log('✅ Bulk submission database tables & indexes initialized successfully.');
    } catch (err) {
        console.error('❌ Failed to initialize bulk submission database tables:', err.message);
    }
};

module.exports = { initBulkTables };
