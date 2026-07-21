const pool = require('../config/database');

// Orders placed before this date were fulfilled via Portal-02 (now decommissioned).
const DATAHOUSE_MIGRATION_DATE = '2026-07-01T00:00:00Z';

// Ensure system_settings table exists and has initial values
const initSettings = async () => {
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(50) PRIMARY KEY,
                setting_value TEXT NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert default maintenance_mode if not exists
        const [rows] = await pool.execute("SELECT setting_key FROM system_settings WHERE setting_key = 'maintenance_mode'");
        if (rows.length === 0) {
            await pool.execute("INSERT INTO system_settings (setting_key, setting_value) VALUES ('maintenance_mode', 'false')");
        }

        // Insert default active_sourcing_api if not exists
        const [apiRows] = await pool.execute("SELECT setting_key FROM system_settings WHERE setting_key = 'active_sourcing_api'");
        if (apiRows.length === 0) {
            await pool.execute("INSERT INTO system_settings (setting_key, setting_value) VALUES ('active_sourcing_api', 'datahouse')");
        }

        // Insert default portal02_api_key if not exists
        const [pKeyRows] = await pool.execute("SELECT setting_key FROM system_settings WHERE setting_key = 'portal02_api_key'");
        if (pKeyRows.length === 0) {
            await pool.execute("INSERT INTO system_settings (setting_key, setting_value) VALUES ('portal02_api_key', 'dk_iGoTZ6KA8-GDrvemBECywzhisNhOpttr')");
        }

        // Insert default datahouse_api_key if not exists
        const [dhKeyRows] = await pool.execute("SELECT setting_key FROM system_settings WHERE setting_key = 'datahouse_api_key'");
        if (dhKeyRows.length === 0) {
            await pool.execute("INSERT INTO system_settings (setting_key, setting_value) VALUES ('datahouse_api_key', 'ak_live_ZSZTCREKE6MUEDPXGE5NWT76U5CHOMPQFNI5XOBO')");
        }
    } catch (error) {
        console.error('System settings init error:', error);
    }
};

// Run init on startup - safely
(async () => {
    try {
        await initSettings();
    } catch (err) {
        console.error('Failed to initialize system settings:', err.message);
    }
})();

const getMaintenanceStatus = async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT setting_value FROM system_settings WHERE setting_key = 'maintenance_mode'");
        const isActive = rows.length > 0 && rows[0].setting_value === 'true';
        res.json({ maintenanceMode: isActive });
    } catch (error) {
        console.error('Get maintenance status error:', error);
        res.status(500).json({
            error: 'Failed to fetch system status',
            details: error.message,
            code: error.code
        });
    }
};

const updateMaintenanceStatus = async (req, res) => {
    try {
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ error: 'isActive must be a boolean' });
        }

        await pool.execute(
            "UPDATE system_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = 'maintenance_mode'",
            [isActive ? 'true' : 'false']
        );

        console.log(`🛠️ Maintenance mode ${isActive ? 'ENABLED' : 'DISABLED'} by admin`);
        res.json({ success: true, maintenanceMode: isActive, message: `Maintenance mode ${isActive ? 'enabled' : 'disabled'}` });
    } catch (error) {
        console.error('Update maintenance status error:', error);
        res.status(500).json({ error: 'Failed to update system status' });
    }
};

// Worker endpoint to process order queue
const processWorker = async (req, res) => {
    try {
        // SECURITY: Simple secret key check to prevent unauthorized triggering
        const secret = req.headers['x-worker-secret'] || req.query.secret;
        const expectedSecret = process.env.WORKER_SECRET || process.env.JWT_SECRET;

        if (!secret || secret !== expectedSecret) {
            console.warn(`🚨 Unauthorized worker process attempt from IP: ${req.ip}`);
            return res.status(401).json({ success: false, error: 'Unauthorized worker access' });
        }

        const { processOrderQueue } = require('../services/orderQueue.service');
        const io = req.app.get('io');
        const result = await processOrderQueue(io);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Worker processing error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Vercel Cron endpoint — processes queue AND syncs statuses
const cronSync = async (req, res) => {
    try {
        // SECURITY: Verify Vercel cron secret OR worker secret
        const cronSecret = req.headers['authorization']?.replace('Bearer ', '');
        const workerSecret = req.headers['x-worker-secret'] || req.query.secret;
        const expectedCronSecret = process.env.CRON_SECRET;
        const expectedWorkerSecret = process.env.WORKER_SECRET || process.env.JWT_SECRET;

        const isAuthorized =
            (expectedCronSecret && cronSecret === expectedCronSecret) ||
            (expectedWorkerSecret && workerSecret === expectedWorkerSecret);

        if (!isAuthorized) {
            console.warn(`🚨 Unauthorized cron attempt from IP: ${req.ip}`);
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        console.log('⏰ [CRON] Starting scheduled sync...');
        const io = req.app.get('io');
        const results = { queue: null, sync: null };

        // 1. Process pending orders (place orders with Datahouse)
        try {
            const { processOrderQueue } = require('../services/orderQueue.service');
            results.queue = await processOrderQueue(io);
            console.log('✅ [CRON] Queue processed:', results.queue);
        } catch (queueErr) {
            console.error('❌ [CRON] Queue error:', queueErr.message);
            results.queue = { error: queueErr.message };
        }

        // 2. Sync statuses for orders already sent to Datahouse
        try {
            const { syncPendingTransactions } = require('../jobs/statusSync');
            await syncPendingTransactions(io);
            results.sync = { success: true };
            console.log('✅ [CRON] Status sync completed');
        } catch (syncErr) {
            console.error('❌ [CRON] Sync error:', syncErr.message);
            results.sync = { error: syncErr.message };
        }

        // 3. Process Partner Webhook Outbox Queue
        try {
            const { processWebhookQueue } = require('../services/partnerWebhook.service');
            results.webhooks = await processWebhookQueue();
            console.log('✅ [CRON] Webhook queue processed:', results.webhooks);
        } catch (webhookErr) {
            console.error('❌ [CRON] Webhook error:', webhookErr.message);
            results.webhooks = { error: webhookErr.message };
        }

        console.log('⏰ [CRON] Scheduled sync complete');
        res.json({ success: true, results });
    } catch (error) {
        console.error('Cron sync error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getSystemConfig = async (req, res) => {
    try {
        res.json({
            paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || null
        });
    } catch (error) {
        console.error('Get system config error:', error);
        res.status(500).json({ error: 'Failed to fetch system configuration' });
    }
};

const getPortalStatus = async (req, res) => {
    try {
        // 1. Get last completed transaction
        const [lastCompletedRows] = await pool.execute(`
            SELECT id, created_at, updated_at 
            FROM transactions 
            WHERE status = 'completed' 
            ORDER BY updated_at DESC LIMIT 1
        `);

        // 2. Get oldest processing transaction (post-migration only)
        const [checkingNowRows] = await pool.execute(`
            SELECT id, created_at 
            FROM transactions 
            WHERE status = 'processing'
            AND created_at >= ?
            ORDER BY created_at ASC LIMIT 1
        `, [DATAHOUSE_MIGRATION_DATE]);

        // 3. Count how many are processing (post-migration only)
        const [processingRows] = await pool.execute(`
            SELECT COUNT(*)::integer as count 
            FROM transactions 
            WHERE status = 'processing'
            AND created_at >= ?
        `, [DATAHOUSE_MIGRATION_DATE]);
        const processingCount = processingRows[0]?.count || 0;

        // Get delay notice setting if any, or compute it
        const [noticeSettings] = await pool.execute(
            "SELECT setting_value FROM system_settings WHERE setting_key = 'portal_delay_notice'"
        );

        const customNotice = noticeSettings.length > 0 ? noticeSettings[0].setting_value : '';

        let delayNotice = '';
        let systemStatus = 'healthy'; // healthy, warning, critical

        if (customNotice) {
            delayNotice = customNotice;
            systemStatus = processingCount > 5 ? 'critical' : (processingCount > 0 ? 'warning' : 'healthy');
        } else {
            if (processingCount === 0) {
                delayNotice = 'All systems operational. Transactions are being delivered instantly.';
                systemStatus = 'healthy';
            } else {
                const oldestAgeMinutes = Math.floor((Date.now() - new Date(checkingNowRows[0].created_at).getTime()) / 60000);
                if (oldestAgeMinutes >= 15) {
                    delayNotice = `MTN/Telecel data delivery portal is experiencing slight delays. Oldest order in queue is ${oldestAgeMinutes} mins old. Currently ${processingCount} order(s) in queue.`;
                    systemStatus = 'critical';
                } else {
                    delayNotice = `Portal is healthy. Currently processing ${processingCount} order(s) in the queue. Estimated delivery: 1-3 minutes.`;
                    systemStatus = 'warning';
                }
            }
        }

        const formatTime = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return d.toLocaleString('en-US', {
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).replace(',', '');
        };

        res.json({
            success: true,
            status: systemStatus,
            delayNotice,
            processingCount,
            lastCompleted: lastCompletedRows.length > 0 ? {
                trackingId: lastCompletedRows[0].id.slice(0, 8),
                placedAt: formatTime(lastCompletedRows[0].created_at),
                deliveredAt: formatTime(lastCompletedRows[0].updated_at)
            } : null,
            checkingNow: checkingNowRows.length > 0 ? {
                trackingId: checkingNowRows[0].id.slice(0, 8)
            } : null
        });

    } catch (error) {
        console.error('Get portal status error:', error);
        res.status(500).json({ error: 'Failed to get portal status' });
    }
};

const getSourcingSettings = async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM sourcing_providers ORDER BY provider_type ASC, name ASC");
        
        let active_sourcing_api = 'datahouse';
        let portal02_api_key = '';
        let datahouse_api_key = '';
        
        for (const row of rows) {
            if (row.is_active) {
                active_sourcing_api = row.slug;
            }
            if (row.slug === 'portal02') {
                portal02_api_key = row.api_key;
            }
            if (row.slug === 'datahouse') {
                datahouse_api_key = row.api_key;
            }
        }
        
        res.json({ 
            success: true, 
            settings: { 
                active_sourcing_api, 
                portal02_api_key, 
                datahouse_api_key,
                providers: rows.map(r => ({
                    id: r.id,
                    name: r.name,
                    slug: r.slug,
                    provider_type: r.provider_type,
                    base_url: r.base_url,
                    api_key: r.api_key,
                    is_active: r.is_active,
                    config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config
                }))
            } 
        });
    } catch (error) {
        console.error('Get sourcing settings error:', error);
        res.status(500).json({ error: 'Failed to fetch sourcing settings' });
    }
};

const updateSourcingSettings = async (req, res) => {
    try {
        const { active_sourcing_api, portal02_api_key, datahouse_api_key } = req.body;

        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            if (active_sourcing_api) {
                // Deactivate all, activate selected
                await connection.execute(
                    "UPDATE sourcing_providers SET is_active = (slug = ?), updated_at = NOW()",
                    [active_sourcing_api]
                );
            }

            if (portal02_api_key !== undefined) {
                await connection.execute(
                    "UPDATE sourcing_providers SET api_key = ?, updated_at = NOW() WHERE slug = 'portal02'",
                    [portal02_api_key]
                );
            }

            if (datahouse_api_key !== undefined) {
                await connection.execute(
                    "UPDATE sourcing_providers SET api_key = ?, updated_at = NOW() WHERE slug = 'datahouse'",
                    [datahouse_api_key]
                );
            }

            await connection.commit();
            res.json({ success: true, message: 'Sourcing settings updated successfully' });
        } catch (error) {
            if (connection) await connection.rollback().catch(() => {});
            throw error;
        } finally {
            if (connection) connection.release();
        }
    } catch (error) {
        console.error('Update sourcing settings error:', error);
        res.status(500).json({ error: 'Failed to update sourcing settings' });
    }
};

const addSourcingProvider = async (req, res) => {
    try {
        const { name, slug, base_url, api_key, config } = req.body;
        if (!name || !slug) {
            return res.status(400).json({ error: 'Name and slug are required' });
        }
        const cleanedSlug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, '');
        
        await pool.execute(
            `INSERT INTO sourcing_providers (name, slug, provider_type, base_url, api_key, config) 
             VALUES (?, ?, 'custom', ?, ?, ?)`,
            [name, cleanedSlug, base_url || '', api_key || '', JSON.stringify(config || {})]
        );
        
        res.json({ success: true, message: 'Custom sourcing provider added successfully' });
    } catch (error) {
        console.error('Add sourcing provider error:', error);
        res.status(500).json({ error: 'Failed to add sourcing provider', details: error.message });
    }
};

const updateSourcingProvider = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, base_url, api_key, config } = req.body;
        
        const [existing] = await pool.execute("SELECT provider_type FROM sourcing_providers WHERE id = ?::uuid", [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Provider not found' });
        }
        
        let query = "UPDATE sourcing_providers SET updated_at = NOW()";
        const params = [];
        
        if (name !== undefined) {
            query += ", name = ?";
            params.push(name);
        }
        if (base_url !== undefined) {
            query += ", base_url = ?";
            params.push(base_url);
        }
        if (api_key !== undefined) {
            query += ", api_key = ?";
            params.push(api_key);
        }
        if (config !== undefined) {
            query += ", config = ?";
            params.push(JSON.stringify(config));
        }
        
        query += " WHERE id = ?::uuid";
        params.push(id);
        
        await pool.execute(query, params);
        res.json({ success: true, message: 'Sourcing provider updated successfully' });
    } catch (error) {
        console.error('Update sourcing provider error:', error);
        res.status(500).json({ error: 'Failed to update sourcing provider', details: error.message });
    }
};

const deleteSourcingProvider = async (req, res) => {
    try {
        const { id } = req.params;
        
        const [existing] = await pool.execute("SELECT provider_type, is_active FROM sourcing_providers WHERE id = ?::uuid", [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Provider not found' });
        }
        
        if (existing[0].provider_type === 'builtin') {
            return res.status(400).json({ error: 'Cannot delete built-in providers' });
        }
        if (existing[0].is_active) {
            return res.status(400).json({ error: 'Cannot delete active provider. Switch to another provider first.' });
        }
        
        await pool.execute("DELETE FROM sourcing_providers WHERE id = ?::uuid", [id]);
        res.json({ success: true, message: 'Custom sourcing provider deleted successfully' });
    } catch (error) {
        console.error('Delete sourcing provider error:', error);
        res.status(500).json({ error: 'Failed to delete sourcing provider' });
    }
};

const activateSourcingProvider = async (req, res) => {
    try {
        const { id } = req.params;
        
        const [existing] = await pool.execute("SELECT id, name FROM sourcing_providers WHERE id = ?::uuid", [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Provider not found' });
        }
        
        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            // Deactivate all, activate selected
            await connection.execute("UPDATE sourcing_providers SET is_active = (id = ?::uuid), updated_at = NOW()", [id]);

            await connection.commit();
            res.json({ success: true, message: `Activated provider ${existing[0].name}` });
        } catch (error) {
            if (connection) await connection.rollback().catch(() => {});
            throw error;
        } finally {
            if (connection) connection.release();
        }
    } catch (error) {
        console.error('Activate sourcing provider error:', error);
        res.status(500).json({ error: 'Failed to activate sourcing provider' });
    }
};

const testSourcingProvider = async (req, res) => {
    try {
        const { id } = req.params;
        const [existing] = await pool.execute("SELECT slug FROM sourcing_providers WHERE id = ?::uuid", [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Provider not found' });
        }
        
        const providerSlug = existing[0].slug;
        const sourcing = require('../utils/sourcing');
        const result = await sourcing.checkBalance(providerSlug);
        
        if (result && result.success) {
            res.json({
                success: true,
                message: 'Connection successful',
                balance: result.balance,
                currency: result.currency || 'GHS'
            });
        } else {
            res.status(400).json({
                success: false,
                error: result?.error || 'Connection failed. Please check your API Key and URL.'
            });
        }
    } catch (error) {
        console.error('Test sourcing provider error:', error);
        res.status(500).json({ error: 'Failed to test sourcing provider', details: error.message });
    }
};

module.exports = {
    getMaintenanceStatus,
    updateMaintenanceStatus,
    processWorker,
    cronSync,
    getSystemConfig,
    getPortalStatus,
    getSourcingSettings,
    updateSourcingSettings,
    addSourcingProvider,
    updateSourcingProvider,
    deleteSourcingProvider,
    activateSourcingProvider,
    testSourcingProvider
};
