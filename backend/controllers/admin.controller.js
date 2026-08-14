const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { logActivity } = require('../utils/activityLogger');
const { encryptSecret } = require('../utils/encryption');
const { triggerTransactionWebhook, validateWebhookUrl } = require('../services/partnerWebhook.service');
const { sendGenericEmail } = require('../services/email.service');
const { sendExportResponse } = require('../utils/exportHelper');

// Create a new user (admin only)
const createUser = async (req, res) => {
    try {
        const { fullName, email, phone, password, role = 'customer' } = req.body;

        if (!fullName || !email || !phone || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (!['customer', 'agent', 'superagent', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be one of: customer, agent, superagent, admin' });
        }

        // Check if email already exists
        const [existing] = await pool.execute(
            'SELECT id FROM profiles WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            const userId = uuidv4();
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user in users table
            await connection.execute(
                'INSERT INTO users (uuid, name, email, phone, password_hash) VALUES (?::uuid, ?, ?, ?, ?)',
                [userId, fullName, email, phone, hashedPassword]
            );

            // Create profile in profiles table
            await connection.execute(
                'INSERT INTO profiles (id, full_name, email, phone, wallet_balance) VALUES (?::uuid, ?, ?, ?, ?)',
                [userId, fullName, email, phone, 0]
            );

            // Create role entry if not customer (customer is default)
            if (role !== 'customer') {
                await connection.execute(
                    'INSERT INTO user_roles (id, user_id, role) VALUES (?::uuid, ?::uuid, ?::user_role)',
                    [uuidv4(), userId, role]
                );
            }

            await connection.commit();

            logActivity(req.user?.id || userId, 'USER_CREATED', `Created user account for ${fullName} (${email}) with role ${role}`, { targetUserId: userId, email, role }, req.ip);

            res.status(201).json({
                message: 'User created successfully',
                id: userId,
                fullName,
                email,
                phone,
                role
            });
        } catch (error) {
            if (connection) await connection.rollback().catch(() => { });
            throw error;
        } finally {
            if (connection) connection.release();
        }
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

// Get all users (with server-side pagination)
const getAllUsers = async (req, res) => {
    try {
        const { parsePagination, buildPaginatedResponse } = require('../utils/pagination');
        const { role, search } = req.query;
        const { page, limit, offset, sortSql } = parsePagination(req.query, {
            defaultPage: 1,
            defaultLimit: 50,
            maxLimit: 100,
            allowedSortFields: {
                createdAt: 'p.created_at',
                name: 'p.full_name',
                email: 'p.email',
                phone: 'p.phone',
                balance: 'p.wallet_balance'
            },
            defaultSort: 'p.created_at DESC'
        });

        let baseFromWhere = `
            FROM profiles p
            LEFT JOIN user_roles ur ON p.id = ur.user_id::uuid
            LEFT JOIN agent_stores s ON p.id = s.user_id::uuid
            LEFT JOIN user_api_keys k ON p.id = k.user_id::uuid AND k.is_active = TRUE
            WHERE 1=1
        `;
        const params = [];

        if (role && role !== 'all') {
            if (role === 'customer') {
                baseFromWhere += " AND (ur.role IS NULL OR ur.role = 'customer')";
            } else {
                baseFromWhere += ' AND ur.role = ?';
                params.push(role);
            }
        }

        if (search && search.trim() !== '') {
            baseFromWhere += ' AND (p.full_name ILIKE ? OR p.email ILIKE ? OR p.phone ILIKE ? OR s.store_name ILIKE ?)';
            const searchTerm = `%${search.trim()}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // 1. Total matching count
        const countQuery = `SELECT COUNT(*) as total ${baseFromWhere}`;
        const [countRows] = await pool.execute(countQuery, params);
        const total = parseInt(countRows[0]?.total || 0, 10);

        // 2. Paginated rows
        const dataQuery = `
            SELECT p.id, p.full_name, p.email, p.phone, p.wallet_balance, p.created_at,
                   COALESCE(ur.role, 'customer') as role,
                   s.id as store_id, s.store_name, s.slug as store_slug, s.activation_status as store_activation_status, s.review_status as store_review_status, s.is_visible as store_is_visible,
                   k.id as api_key_id, k.api_key as raw_api_key, k.is_active as api_key_active, k.last_used as api_key_last_used, k.created_at as api_key_created_at
            ${baseFromWhere}
            ORDER BY ${sortSql}
            LIMIT ? OFFSET ?
        `;
        const dataParams = [...params, limit, offset];
        const [users] = await pool.execute(dataQuery, dataParams);

        const formatted = users.map(u => {
            let maskedKey = null;
            if (u.raw_api_key) {
                const keyStr = String(u.raw_api_key);
                const prefix = keyStr.slice(0, 7);
                const suffix = keyStr.slice(-4);
                maskedKey = `${prefix}************${suffix}`;
            }

            return {
                id: u.id,
                fullName: u.full_name,
                email: u.email,
                phone: u.phone,
                walletBalance: parseFloat(u.wallet_balance) || 0,
                role: u.role,
                isActive: u.is_active === undefined ? true : Boolean(u.is_active),
                createdAt: u.created_at,
                store: u.store_id ? {
                    id: u.store_id,
                    name: u.store_name,
                    slug: u.store_slug,
                    activationStatus: u.store_activation_status,
                    reviewStatus: u.store_review_status,
                    isVisible: u.store_is_visible
                } : null,
                apiAccess: u.api_key_id ? {
                    hasKey: true,
                    maskedKey,
                    isActive: Boolean(u.api_key_active),
                    lastUsed: u.api_key_last_used,
                    createdAt: u.api_key_created_at
                } : null
            };
        });

        if (req.query.legacy === 'true') {
            return res.json(formatted);
        }

        res.json(buildPaginatedResponse(formatted, total, page, limit));

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
};

// Change user role
const changeUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['customer', 'agent', 'superagent', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be one of: customer, agent, superagent, admin' });
        }

        const [userRows] = await pool.execute('SELECT email, role FROM users WHERE uuid = ?::uuid', [id]);
        const oldRole = userRows.length > 0 ? userRows[0].role : 'unknown';

        // Update the role in the main users table
        await pool.execute(
            'UPDATE users SET role = ?::user_role, updated_at = CURRENT_TIMESTAMP WHERE uuid = ?::uuid',
            [role, id]
        );

        // Also update/insert in user_roles table for extended role management
        const [existing] = await pool.execute(
            'SELECT id FROM user_roles WHERE user_id = ?::uuid',
            [id]
        );

        if (existing.length > 0) {
            await pool.execute(
                'UPDATE user_roles SET role = ?::user_role WHERE user_id = ?::uuid',
                [role, id]
            );
        } else {
            await pool.execute(
                'INSERT INTO user_roles (id, user_id, role) VALUES (?::uuid, ?::uuid, ?::user_role)',
                [uuidv4(), id, role]
            );
        }

        logActivity(req.user?.id, 'USER_ROLE_CHANGED', `Changed user ${id.slice(0, 8)} role from ${oldRole} to ${role}`, { targetUserId: id, oldRole, newRole: role }, req.ip);

        const io = req.app.get('io') || global.io;
        if (io) {
            const rolePayload = { userId: id, role };
            io.to(id).emit('roleUpdate', rolePayload);
            io.to('admins').emit('roleUpdate', rolePayload);
            io.emit('roleUpdate', rolePayload);
            io.emit('userStatsUpdate', { userId: id });
        }

        res.json({ message: `User role changed to ${role}` });

    } catch (error) {
        console.error('Change role error:', error);
        res.status(500).json({ error: 'Failed to change role' });
    }
};

// Update user details
const updateUser = async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const { fullName, email, phone } = req.body;

        if (!fullName || !email || !phone) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Update profiles table
        await connection.execute(
            'UPDATE profiles SET full_name = ?, email = ?, phone = ? WHERE id = ?::uuid',
            [fullName, email, phone, id]
        );

        // Update users table
        await connection.execute(
            'UPDATE users SET name = ?, email = ?, phone = ? WHERE uuid = ?::uuid',
            [fullName, email, phone, id]
        );

        await connection.commit();

        logActivity(req.user?.id, 'USER_UPDATED', `Updated account details for ${fullName} (${email})`, { targetUserId: id, fullName, email, phone }, req.ip);

        res.json({ message: 'User updated successfully' });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => { });
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    } finally {
        if (connection) connection.release();
    }
};


const deleteUser = async (req, res) => {
    let connection;
    try {
        const { id } = req.params;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Delete from user_roles
        await connection.execute('DELETE FROM user_roles WHERE user_id = ?::uuid', [id]);
        // Delete from profiles
        await connection.execute('DELETE FROM profiles WHERE id = ?::uuid', [id]);
        // Delete from users
        await connection.execute('DELETE FROM users WHERE uuid = ?::uuid', [id]);

        await connection.commit();

        logActivity(req.user?.id, 'USER_DELETED', `Deleted user account ${id}`, { targetUserId: id }, req.ip);

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => { });
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    } finally {
        if (connection) connection.release();
    }
};

// Toggle user account status (active/suspended)
const toggleUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (isActive === undefined) {
            return res.status(400).json({ error: 'isActive status is required' });
        }

        await pool.execute(
            'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE uuid = ?::uuid',
            [isActive, id]
        );

        const actionType = isActive ? 'USER_ACTIVATED' : 'USER_SUSPENDED';
        logActivity(req.user?.id, actionType, `${isActive ? 'Activated' : 'Suspended'} user account ${id.slice(0, 8)}`, { targetUserId: id, isActive }, req.ip);

        res.json({
            message: `User account ${isActive ? 'activated' : 'suspended'} successfully`,
            id,
            isActive
        });
    } catch (error) {
        console.error('Toggle user status error:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
};

// Get all transactions (admin - unified view of direct & agent store orders with server-side pagination)
const getAllTransactions = async (req, res) => {
    try {
        const { parsePagination, buildPaginatedResponse } = require('../utils/pagination');
        const { status, network, search } = req.query;
        const { page, limit, offset, sortSql } = parsePagination(req.query, {
            defaultPage: 1,
            defaultLimit: 50,
            maxLimit: 100,
            allowedSortFields: {
                createdAt: 'created_at',
                updatedAt: 'updated_at',
                amount: 'amount_ghc',
                status: 'status',
                network: 'network',
                phone: 'recipient_phone'
            },
            defaultSort: 'created_at DESC'
        });

        let baseFromWhere = `
            FROM (
                SELECT 
                    t.id::text as id, 
                    t.recipient_phone, 
                    t.amount_ghc, 
                    COALESCE(t.current_datahouse_status, t.status) as status, 
                    t.created_at, 
                    t.updated_at,
                    t.serial_id, 
                    t.balance_before, 
                    t.balance_after, 
                    COALESCE(t.source, 'BYTEBEACON') as source, 
                    t.paid, 
                    t.source_provider,
                    t.datahouse_order_id,
                    t.reference_code,
                    t.last_synced_at,
                    t.sync_status,
                    t.current_datahouse_status as datahouse_status,
                    d.network, 
                    d.data_amount,
                    COALESCE(p.full_name, u.name, 'Customer') as user_name, 
                    COALESCE(p.email, u.email, 'N/A') as user_email
                FROM transactions t
                LEFT JOIN data_bundles d ON t.bundle_id::text = d.id::text
                LEFT JOIN users u ON t.user_id::text = u.uuid::text
                LEFT JOIN profiles p ON t.user_id::text = p.id::text

                UNION ALL

                SELECT 
                    o.id::text as id,
                    o.customer_phone as recipient_phone,
                    o.selling_price_ghc as amount_ghc,
                    COALESCE(o.current_datahouse_status, o.fulfillment_status) as status,
                    o.created_at,
                    o.updated_at,
                    NULL as serial_id,
                    NULL as balance_before,
                    NULL as balance_after,
                    'AGENT_STORE' as source,
                    o.payment_status as paid,
                    COALESCE(b.provider_slug, 'datahouse') as source_provider,
                    o.datahouse_order_id,
                    o.reference_code,
                    o.last_synced_at,
                    o.sync_status,
                    o.current_datahouse_status as datahouse_status,
                    o.network,
                    o.data_amount,
                    CONCAT(s.store_name, ' (Storefront)') as user_name,
                    COALESCE(u.email, 'storefront@bytebeacon.online') as user_email
                FROM agent_orders o
                LEFT JOIN agent_stores s ON o.store_id = s.id
                LEFT JOIN users u ON o.agent_id = u.uuid
                LEFT JOIN data_bundles b ON o.bundle_id = b.id::uuid
            ) combined_orders
            WHERE status != 'pending_mtn_approval'
        `;
        const params = [];

        if (status && status !== 'all') {
            baseFromWhere += ' AND status = ?';
            params.push(status);
        }

        if (network && network !== 'all') {
            baseFromWhere += ' AND LOWER(network) LIKE ?';
            params.push(`%${network.toLowerCase()}%`);
        }

        if (search && search.trim() !== '') {
            const term = `%${search.trim()}%`;
            baseFromWhere += ` AND (
                recipient_phone LIKE ? 
                OR user_name ILIKE ? 
                OR user_email ILIKE ? 
                OR id LIKE ? 
                OR (serial_id IS NOT NULL AND serial_id::text LIKE ?)
                OR datahouse_order_id ILIKE ?
                OR reference_code ILIKE ?
            )`;
            params.push(term, term, term, term, term, term, term);
        }

        // 1. Total matching count
        const countQuery = `SELECT COUNT(*) as total ${baseFromWhere}`;
        const [countRows] = await pool.execute(countQuery, params);
        const total = parseInt(countRows[0]?.total || 0, 10);

        // 2. Paginated rows
        const dataQuery = `SELECT * ${baseFromWhere} ORDER BY ${sortSql} LIMIT ? OFFSET ?`;
        const dataParams = [...params, limit, offset];
        const [transactions] = await pool.execute(dataQuery, dataParams);

        const formatted = transactions.map(t => ({
            id: t.id,
            recipientPhone: t.recipient_phone,
            amount: parseFloat(t.amount_ghc),
            status: t.status,
            network: t.network || 'N/A',
            dataAmount: t.data_amount || 'N/A',
            userName: t.user_name || 'Unknown',
            userEmail: t.user_email || 'N/A',
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            serialId: t.serial_id,
            balanceBefore: t.balance_before ? parseFloat(t.balance_before) : null,
            balanceAfter: t.balance_after ? parseFloat(t.balance_after) : null,
            source: t.source,
            paid: t.paid,
            sourceProvider: t.source_provider,
            datahouseOrderId: t.datahouse_order_id || null,
            datahousePublicId: t.datahouse_order_id || null,
            referenceCode: t.reference_code || null,
            datahouseStatus: t.datahouse_status || t.status,
            lastSyncedAt: t.last_synced_at || null,
            syncStatus: t.sync_status || 'synced'
        }));

        if (req.query.legacy === 'true') {
            return res.json(formatted);
        }

        res.json(buildPaginatedResponse(formatted, total, page, limit));

    } catch (error) {
        console.error('Get all transactions error:', error);
        res.status(500).json({ error: 'Failed to get transactions' });
    }
};

// Get transaction statistics (admin)
const getTransactionStats = async (req, res) => {
    try {
        const [stats] = await pool.execute(`
            SELECT 
                COUNT(*) as "totalTransactions",
                SUM(CASE WHEN status = 'completed' THEN amount_ghc ELSE 0 END) as "completedValue",
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as "completedCount",
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as "pendingCount",
                SUM(CASE WHEN status IN ('failed', 'refunded') THEN 1 ELSE 0 END) as "failedCount"
            FROM (
                SELECT amount_ghc, status FROM transactions
                UNION ALL
                SELECT selling_price_ghc as amount_ghc, fulfillment_status as status FROM agent_orders
            ) combined
        `);

        const result = stats[0];
        res.json({
            totalTransactions: parseInt(result.totalTransactions) || 0,
            completedValue: parseFloat(result.completedValue) || 0,
            completedCount: parseInt(result.completedCount) || 0,
            pendingCount: parseInt(result.pendingCount) || 0,
            failedCount: parseInt(result.failedCount) || 0
        });
    } catch (error) {
        console.error('Get transaction stats error:', error);
        res.status(500).json({ error: 'Failed to get transaction stats' });
    }
};

// Update transaction status - DEPRECATED: Disallow direct manual status mutations; redirect to authoritative DataHouse sync
const updateTransactionStatus = async (req, res) => {
    return res.status(405).json({
        success: false,
        error: 'MANUAL_STATUS_MUTATION_DISALLOWED',
        message: 'Direct telecom status mutation is disabled. Telecom orders are strictly governed by DataHouse. Use /api/transactions/:id/sync to reconcile with DataHouse.'
    });
};

// CRUD for bundles
const getAllBundles = async (req, res) => {
    try {
        const [bundles] = await pool.execute(
            'SELECT id, network, data_amount, price_ghc, agent_price_ghc, is_active, provider_slug, created_at FROM data_bundles ORDER BY network, price_ghc'
        );

        const formattedBundles = bundles.map(b => ({
            id: b.id,
            network: b.network,
            dataAmount: b.data_amount,
            priceGhc: parseFloat(b.price_ghc),
            agentPriceGhc: parseFloat(b.agent_price_ghc || b.price_ghc),
            isActive: Boolean(b.is_active),
            providerSlug: b.provider_slug || null,
            createdAt: b.created_at
        }));

        res.json(formattedBundles);
    } catch (error) {
        console.error('Admin get all bundles error:', error);
        res.status(500).json({ error: 'Failed to fetch all bundles' });
    }
};

const createBundle = async (req, res) => {
    try {
        const { network, dataAmount, priceGhc, agentPriceGhc, providerSlug } = req.body;

        if (!network || !dataAmount || !priceGhc) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const id = uuidv4();
        const finalAgentPrice = (agentPriceGhc !== undefined && agentPriceGhc !== null) ? agentPriceGhc : priceGhc;

        await pool.execute(
            'INSERT INTO data_bundles (id, network, data_amount, price_ghc, agent_price_ghc, is_active, provider_slug) VALUES (?::uuid, ?, ?, ?, ?, ?, ?)',
            [id, network.toUpperCase(), dataAmount, priceGhc, finalAgentPrice, true, providerSlug || null]
        );

        logActivity(req.user?.id, 'DATA_PLAN_CREATED', `Created ${dataAmount} ${network.toUpperCase()} data plan at GHS ${priceGhc}`, { bundleId: id, network: network.toUpperCase(), dataAmount, priceGhc, agentPriceGhc: finalAgentPrice }, req.ip);

        res.status(201).json({
            message: 'Bundle created',
            id,
            network: network.toUpperCase(),
            dataAmount,
            priceGhc,
            agentPriceGhc,
            providerSlug: providerSlug || null
        });

    } catch (error) {
        console.error('Create bundle error:', error);
        res.status(500).json({ error: 'Failed to create bundle' });
    }
};

const updateBundle = async (req, res) => {
    try {
        const { id } = req.params;
        const { network, dataAmount, priceGhc, agentPriceGhc, isActive, providerSlug } = req.body;

        console.log('Update bundle request:', { id, network, dataAmount, priceGhc, agentPriceGhc, isActive, providerSlug });

        // Build dynamic update query - only update fields that are provided
        const updates = [];
        const params = [];

        if (network !== undefined) {
            updates.push('network = ?');
            params.push(network.toUpperCase());
        }
        if (dataAmount !== undefined) {
            updates.push('data_amount = ?');
            params.push(dataAmount);
        }
        if (priceGhc !== undefined) {
            updates.push('price_ghc = ?');
            params.push(priceGhc);
        }
        if (agentPriceGhc !== undefined) {
            updates.push('agent_price_ghc = ?');
            params.push(agentPriceGhc);
        }
        if (isActive !== undefined) {
            updates.push('is_active = ?');
            params.push(isActive);
        }
        if (providerSlug !== undefined) {
            updates.push('provider_slug = ?');
            params.push(providerSlug || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(id);
        const query = `UPDATE data_bundles SET ${updates.join(', ')} WHERE id = ?::uuid`;

        await pool.execute(query, params);

        let actionType = 'DATA_PLAN_UPDATED';
        if (isActive !== undefined) {
            actionType = isActive ? 'DATA_PLAN_ENABLED' : 'DATA_PLAN_DISABLED';
        }

        logActivity(req.user?.id, actionType, `${actionType === 'DATA_PLAN_ENABLED' ? 'Enabled' : (actionType === 'DATA_PLAN_DISABLED' ? 'Disabled' : 'Updated')} data plan ${id.slice(0, 8)}`, { bundleId: id, network, dataAmount, priceGhc, isActive }, req.ip);

        res.json({ message: 'Bundle updated' });

    } catch (error) {
        console.error('Update bundle error:', error);
        res.status(500).json({ error: 'Failed to update bundle' });
    }
};

const deleteBundle = async (req, res) => {
    try {
        const { id } = req.params;

        // Try real delete
        await pool.execute(
            'DELETE FROM data_bundles WHERE id = ?::uuid',
            [id]
        );

        logActivity(req.user?.id, 'DATA_PLAN_DELETED', `Permanently deleted data plan ${id.slice(0, 8)}`, { bundleId: id }, req.ip);

        res.json({ message: 'Bundle deleted permanently' });

    } catch (error) {
        console.error('Delete bundle error:', error);

        // If it fails due to foreign key (transactions exists)
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
            return res.status(400).json({
                error: 'Cannot delete this plan because it has been used in transactions. Please disable it instead.'
            });
        }

        res.status(500).json({ error: 'Failed to delete data plan' });
    }
};

// Get dashboard stats
const getDashboardStats = async (req, res) => {
    try {
        const [[{ totalUsers }]] = await pool.execute(
            'SELECT COUNT(*) as "totalUsers" FROM users WHERE is_active = true'
        );

        const [[{ todayOrders }]] = await pool.execute(
            'SELECT COUNT(*) as "todayOrders" FROM transactions WHERE created_at >= CURRENT_DATE'
        );

        const [[{ todayRevenue }]] = await pool.execute(
            "SELECT COALESCE(SUM(amount_ghc), 0) as \"todayRevenue\" FROM transactions WHERE status = 'completed' AND created_at >= CURRENT_DATE"
        );

        const [[{ pendingOrders }]] = await pool.execute(
            "SELECT COUNT(*) as \"pendingOrders\" FROM transactions WHERE status = 'processing'"
        );

        // Get monthly revenue
        const [[{ monthlyRevenue }]] = await pool.execute(
            "SELECT COALESCE(SUM(amount_ghc), 0) as \"monthlyRevenue\" FROM transactions WHERE status = 'completed' AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)"
        );

        // Query role stats (User, Agent, SuperAgent)
        const [roleRows] = await pool.execute(`
            SELECT 
                COALESCE(ur.role, 'customer') as role,
                COUNT(*)::integer as "totalOrders",
                COALESCE(SUM(CASE WHEN t.created_at >= CURRENT_DATE AND t.status = 'completed' THEN t.amount_ghc ELSE 0 END), 0)::float as "dailyRevenue",
                COALESCE(SUM(CASE WHEN date_trunc('month', t.created_at) = date_trunc('month', CURRENT_DATE) AND t.status = 'completed' THEN t.amount_ghc ELSE 0 END), 0)::float as "monthlyRevenue"
            FROM transactions t
            LEFT JOIN user_roles ur ON t.user_id = ur.user_id::uuid
            GROUP BY COALESCE(ur.role, 'customer')
        `);

        const roleStats = {
            customer: { dailyRevenue: 0, monthlyRevenue: 0, totalOrders: 0 },
            agent: { dailyRevenue: 0, monthlyRevenue: 0, totalOrders: 0 },
            superagent: { dailyRevenue: 0, monthlyRevenue: 0, totalOrders: 0 }
        };

        roleRows.forEach(row => {
            const roleKey = row.role === 'customer' || row.role === 'user' ? 'customer' : row.role;
            if (roleStats[roleKey] !== undefined) {
                roleStats[roleKey] = {
                    dailyRevenue: parseFloat(row.dailyRevenue) || 0,
                    monthlyRevenue: parseFloat(row.monthlyRevenue) || 0,
                    totalOrders: parseInt(row.totalOrders) || 0
                };
            }
        });

        res.json({
            totalUsers,
            todayOrders,
            todayRevenue: parseFloat(todayRevenue) || 0,
            monthlyRevenue: parseFloat(monthlyRevenue) || 0,
            pendingOrders,
            roleStats
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
};

// Notifications
const sendNotification = async (req, res) => {
    try {
        const { userId, targetGroup, title, message, type = 'info' } = req.body;

        if (!title || !message) {
            return res.status(400).json({ error: 'Title and message are required' });
        }

        const io = req.app.get('io');
        let targetUsers = [];

        if (userId) {
            targetUsers = [{ id: userId }];
        } else if (targetGroup === 'customers') {
            const [rows] = await pool.execute(`
                SELECT p.id FROM profiles p
                LEFT JOIN user_roles ur ON p.id = ur.user_id::uuid
                WHERE ur.role = 'customer' OR ur.role IS NULL
            `);
            targetUsers = rows;
        } else if (targetGroup === 'agents') {
            const [rows] = await pool.execute(`
                SELECT p.id FROM profiles p
                INNER JOIN user_roles ur ON p.id = ur.user_id::uuid
                WHERE ur.role = 'agent'
            `);
            targetUsers = rows;
        } else if (targetGroup === 'superagents') {
            const [rows] = await pool.execute(`
                SELECT p.id FROM profiles p
                INNER JOIN user_roles ur ON p.id = ur.user_id::uuid
                WHERE ur.role = 'superagent'
            `);
            targetUsers = rows;
        } else if (targetGroup === 'agent_store_users') {
            const [rows] = await pool.execute(`
                SELECT DISTINCT user_id as id FROM agent_stores
            `);
            targetUsers = rows;
        } else if (targetGroup === 'admins') {
            const [rows] = await pool.execute(`
                SELECT p.id FROM profiles p
                INNER JOIN user_roles ur ON p.id = ur.user_id::uuid
                WHERE ur.role = 'admin'
            `);
            targetUsers = rows;
        } else {
            // 'all' or default broadcast
            const [rows] = await pool.execute('SELECT id FROM profiles');
            targetUsers = rows;
        }

        let sentCount = 0;

        if (targetUsers.length > 0) {
            for (const u of targetUsers) {
                const notifId = uuidv4();
                await pool.execute(
                    'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?::uuid, ?::uuid, ?, ?, ?)',
                    [notifId, u.id, title, message, type]
                );

                const notificationData = {
                    id: notifId,
                    title,
                    message,
                    type,
                    isRead: false,
                    createdAt: new Date()
                };

                if (io) {
                    io.to(u.id).emit('newNotification', notificationData);
                }
                sentCount++;
            }
        } else {
            // Fallback general broadcast
            const id = uuidv4();
            await pool.execute(
                'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?::uuid, NULL, ?, ?, ?)',
                [id, title, message, type]
            );
            if (io) {
                io.emit('newNotification', { id, title, message, type, isRead: false, createdAt: new Date() });
            }
            sentCount = 1;
        }

        logActivity(req.user?.id, 'NOTIFICATION_SENT', `Sent system notification "${title}" to ${sentCount} user(s)`, { targetGroup: targetGroup || userId || 'broadcast', title, type, sentCount }, req.ip);

        res.status(201).json({ message: `Notification dispatched successfully to ${sentCount} user(s)`, sentCount });
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
};

const getAllNotifications = async (req, res) => {
    try {
        const [notifications] = await pool.execute(
            'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100'
        );
        res.json(notifications);
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to get notifications' });
    }
};

const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute(
            'UPDATE notifications SET is_read = TRUE WHERE id = ?::uuid',
            [id]
        );
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute(
            'DELETE FROM notifications WHERE id = ?::uuid',
            [id]
        );
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
};

// Mark all notifications as read
const markAllNotificationsRead = async (req, res) => {
    try {
        await pool.execute(
            'UPDATE notifications SET is_read = TRUE'
        );
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
};

// Clear all notifications
const clearAllNotifications = async (req, res) => {
    try {
        await pool.execute(
            'DELETE FROM notifications'
        );
        res.json({ message: 'All notifications cleared' });
    } catch (error) {
        console.error('Clear all notifications error:', error);
        res.status(500).json({ error: 'Failed to clear notifications' });
    }
};

const sendEmail = async (req, res) => {
    try {
        const { to, subject, body, sendSmtp = true } = req.body;

        if (!subject || !body) {
            return res.status(400).json({ error: 'Subject and body are required' });
        }

        const io = req.app.get('io');
        let users = [];

        if (to === 'all') {
            const [rows] = await pool.execute('SELECT p.id, p.full_name, u.email FROM profiles p JOIN users u ON p.id = u.uuid::uuid');
            users = rows;
        } else if (to === 'customers') {
            const [rows] = await pool.execute(`
                SELECT p.id, p.full_name, u.email FROM profiles p
                JOIN users u ON p.id = u.uuid::uuid
                LEFT JOIN user_roles ur ON p.id = ur.user_id::uuid
                WHERE ur.role = 'customer' OR ur.role IS NULL
            `);
            users = rows;
        } else if (to === 'agents') {
            const [rows] = await pool.execute(`
                SELECT p.id, p.full_name, u.email FROM profiles p
                JOIN users u ON p.id = u.uuid::uuid
                INNER JOIN user_roles ur ON p.id = ur.user_id::uuid
                WHERE ur.role = 'agent'
            `);
            users = rows;
        } else if (to === 'superagents') {
            const [rows] = await pool.execute(`
                SELECT p.id, p.full_name, u.email FROM profiles p
                JOIN users u ON p.id = u.uuid::uuid
                INNER JOIN user_roles ur ON p.id = ur.user_id::uuid
                WHERE ur.role = 'superagent'
            `);
            users = rows;
        } else if (to === 'agent_store_users') {
            const [rows] = await pool.execute(`
                SELECT DISTINCT p.id, p.full_name, u.email 
                FROM agent_stores s
                JOIN profiles p ON s.user_id = p.id
                JOIN users u ON p.id = u.uuid::uuid
            `);
            users = rows;
        } else if (to && to.includes('@')) {
            const emails = to.split(',').map(e => e.trim()).filter(e => e);
            if (emails.length > 0) {
                const placeholders = emails.map(() => '?').join(',');
                const [rows] = await pool.execute(
                    `SELECT p.id, p.full_name, u.email FROM profiles p JOIN users u ON p.id = u.uuid::uuid WHERE u.email IN (${placeholders})`,
                    emails
                );
                users = rows;
            }
        }

        if (users.length === 0) {
            return res.status(400).json({ error: 'No matching recipients found' });
        }

        let sentCount = 0;
        let smtpSentCount = 0;
        let smtpFailedCount = 0;

        for (const user of users) {
            try {
                const messageId = uuidv4();
                await pool.execute(
                    'INSERT INTO messages (id, sender_id, recipient_id, subject, body) VALUES (?::uuid, ?, ?, ?, ?)',
                    [messageId, req.user.id, user.id, subject, body]
                );

                if (io) {
                    io.to(user.id).emit('newMessage', {
                        id: messageId,
                        senderId: req.user.id,
                        senderName: 'Admin',
                        subject,
                        body,
                        isRead: false,
                        createdAt: new Date()
                    });
                }
                sentCount++;

                // Send actual SMTP email if requested and recipient has valid email
                if (sendSmtp && user.email) {
                    const mailRes = await sendGenericEmail({
                        to: user.email,
                        subject: subject,
                        text: body
                    });
                    if (mailRes.success) smtpSentCount++;
                    else smtpFailedCount++;
                }
            } catch (err) {
                console.error(`Failed to send message to user ${user.id}:`, err);
            }
        }

        logActivity(req.user?.id, 'EMAIL_SENT', `Sent administrative email/message to ${sentCount} user(s): "${subject}"`, { targetGroup: to, recipientCount: sentCount, smtpSentCount, subject }, req.ip);

        res.json({
            message: `Communication dispatched successfully to ${sentCount} user(s). SMTP emails sent: ${smtpSentCount}, failed: ${smtpFailedCount}.`,
            sentCount,
            smtpSentCount,
            smtpFailedCount
        });
    } catch (error) {
        console.error('Send email/message error:', error);
        res.status(500).json({ error: 'Failed to send messages or emails' });
    }
};

const getAnalytics = async (req, res) => {
    try {
        let users = [{ total: 0 }];
        let agents = [{ total: 0 }];
        let transactions = [];
        let userGrowth = [];
        let todayOrders = 0;
        let todayRevenue = 0;

        try { [users] = await pool.execute('SELECT COUNT(*) as total FROM profiles'); } catch (e) { console.error('Users query fail:', e); }
        try { [agents] = await pool.execute("SELECT COUNT(*) as total FROM user_roles WHERE role = 'agent' OR role = 'superagent'"); } catch (e) { console.error('Agents query fail:', e); }
        try { [transactions] = await pool.execute('SELECT t.*, db.network FROM transactions t LEFT JOIN data_bundles db ON t.bundle_id = db.id::uuid ORDER BY t.created_at DESC LIMIT 500'); } catch (e) { console.error('Tx query fail:', e); }
        try { [userGrowth] = await pool.execute('SELECT created_at FROM profiles ORDER BY created_at ASC'); } catch (e) { console.error('Growth query fail:', e); }

        try {
            const [[resOrders]] = await pool.execute('SELECT COUNT(*) as "todayOrders" FROM transactions WHERE created_at >= CURRENT_DATE');
            todayOrders = resOrders?.todayOrders || 0;
        } catch (e) { console.error('Today orders query fail:', e); }

        try {
            const [[resRev]] = await pool.execute("SELECT COALESCE(SUM(amount_ghc), 0) as \"todayRevenue\" FROM transactions WHERE status = 'completed' AND created_at >= CURRENT_DATE");
            todayRevenue = resRev?.todayRevenue || 0;
        } catch (e) { console.error('Today revenue query fail:', e); }

        res.json({
            totalUsers: users[0]?.total || 0,
            totalAgents: agents[0]?.total || 0,
            todayOrders,
            todayRevenue: parseFloat(todayRevenue) || 0,
            transactions,
            userGrowth,
            monthlyGrowth: 15.5
        });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
};

// Send message to user
const sendMessage = async (req, res) => {
    try {
        const { recipientId, subject, body } = req.body;

        if (!recipientId || !body) {
            return res.status(400).json({ error: 'Recipient and message body are required' });
        }

        const id = uuidv4();
        await pool.execute(
            'INSERT INTO messages (id, sender_id, recipient_id, subject, body) VALUES (?::uuid, ?, ?, ?, ?)',
            [id, req.user.id, recipientId, subject || 'No Subject', body]
        );

        // Emit real-time message via Socket.IO
        const io = req.app.get('io');
        io.to(recipientId).emit('newMessage', {
            id,
            senderId: req.user.id,
            senderName: req.user.fullName || 'Admin',
            subject: subject || 'No Subject',
            body,
            isRead: false,
            createdAt: new Date()
        });

        logActivity(req.user?.id, 'MESSAGE_SENT', `Sent direct message to user ${recipientId.slice(0, 8)}: "${subject || 'No Subject'}"`, { messageId: id, recipientId, subject }, req.ip);

        res.status(201).json({ message: 'Message sent successfully', id });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

// Get all messages (admin view)
const getMessages = async (req, res) => {
    try {
        const [messages] = await pool.execute(`
            SELECT m.*, 
                   ps.full_name as sender_name, ps.email as sender_email,
                   pr.full_name as recipient_name, pr.email as recipient_email,
                   COALESCE(urs.role::text, 'customer') as sender_role,
                   COALESCE(urr.role::text, 'customer') as recipient_role
            FROM messages m
            LEFT JOIN profiles ps ON (CASE WHEN m.sender_id ~ '^[0-9a-fA-F-]{36}$' THEN m.sender_id::uuid ELSE NULL END) = ps.id
            LEFT JOIN profiles pr ON (CASE WHEN m.recipient_id ~ '^[0-9a-fA-F-]{36}$' THEN m.recipient_id::uuid ELSE NULL END) = pr.id
            LEFT JOIN user_roles urs ON (CASE WHEN m.sender_id ~ '^[0-9a-fA-F-]{36}$' THEN m.sender_id::uuid ELSE NULL END) = urs.user_id::uuid
            LEFT JOIN user_roles urr ON (CASE WHEN m.recipient_id ~ '^[0-9a-fA-F-]{36}$' THEN m.recipient_id::uuid ELSE NULL END) = urr.user_id::uuid
            ORDER BY m.created_at DESC
            LIMIT 100
        `);

        const formatted = messages.map(m => {
            // Handle special sender IDs
            let senderName = m.sender_name;
            let senderEmail = m.sender_email || '';
            let senderRole = m.sender_role || 'customer';
            if (m.sender_id === 'system') {
                senderName = 'ByteBeacon System';
                senderEmail = 'noreply@bytebeacon.com';
                senderRole = 'system';
            } else if (!senderName) {
                senderName = 'Unknown User';
            }

            // Handle special recipient IDs
            let recipientName = m.recipient_name;
            let recipientEmail = m.recipient_email || '';
            let recipientRole = m.recipient_role || 'customer';
            if (m.recipient_id === 'admin') {
                recipientName = 'Support Team';
                recipientEmail = 'support@bytebeacon.com';
                recipientRole = 'admin';
            } else if (!recipientName) {
                recipientName = 'Unknown User';
            }

            return {
                id: m.id,
                senderId: m.sender_id,
                senderName,
                senderEmail,
                senderRole,
                recipientId: m.recipient_id,
                recipientName,
                recipientEmail,
                recipientRole,
                subject: m.subject,
                body: m.body,
                isRead: Boolean(m.is_read),
                createdAt: m.created_at
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
};


// Delete message (admin)
const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM messages WHERE id = ?::uuid', [id]);
        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
};

// Mark message as read (admin)
const markMessageRead = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('UPDATE messages SET is_read = TRUE WHERE id = ?::uuid', [id]);
        res.json({ message: 'Message marked as read' });
    } catch (error) {
        console.error('Mark message read error:', error);
        res.status(500).json({ error: 'Failed to mark message as read' });
    }
};

// Get all agent applications
const getAgentApplications = async (req, res) => {
    try {
        const { status } = req.query;

        let query = `
            SELECT ar.*, p.full_name, p.email, p.phone
            FROM agent_requests ar
            JOIN profiles p ON ar.user_id = p.id
        `;
        const params = [];

        if (status && status !== 'all') {
            query += ' WHERE ar.status = ?';
            params.push(status);
        }

        query += ' ORDER BY ar.created_at DESC';

        const [applications] = await pool.execute(query, params);

        const formatted = applications.map(app => ({
            id: app.id,
            userId: app.user_id,
            fullName: app.full_name,
            email: app.email,
            phone: app.phone,
            businessName: app.business_name,
            reason: app.reason,
            experience: app.experience,
            status: app.status,
            adminNotes: app.admin_notes,
            requestType: app.request_type || 'superagent',
            createdAt: app.created_at,
            updatedAt: app.updated_at
        }));

        res.json(formatted);
    } catch (error) {
        console.error('Get agent applications error:', error);
        res.status(500).json({ error: 'Failed to get agent applications' });
    }
};

// Update agent application (approve/reject)
const updateAgentApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNotes } = req.body;

        if (!['processing', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Update the application status
            await connection.execute(
                'UPDATE agent_requests SET status = ?, admin_notes = ?, updated_at = NOW() WHERE id = ?::uuid',
                [status, adminNotes || null, id]
            );

            // Get user info for the application
            const [[application]] = await connection.execute(
                'SELECT ar.user_id, ar.request_type, p.full_name FROM agent_requests ar LEFT JOIN profiles p ON ar.user_id = p.id WHERE ar.id = ?::uuid',
                [id]
            );

            const io = req.app.get('io');

            // If approved, update the user's role to 'superagent' or 'agent'
            if (status === 'approved' && application) {
                const targetRole = (application.request_type === 'agent') ? 'agent' : 'superagent';
                const roleLabel = targetRole === 'agent' ? 'Agent' : 'SuperAgent';
                const [existing] = await connection.execute(
                    'SELECT id FROM user_roles WHERE user_id = ?::uuid',
                    [application.user_id]
                );

                if (existing.length > 0) {
                    await connection.execute(
                        'UPDATE user_roles SET role = ?::user_role WHERE user_id = ?::uuid',
                        [targetRole, application.user_id]
                    );
                } else {
                    await connection.execute(
                        'INSERT INTO user_roles (id, user_id, role) VALUES (?::uuid, ?::uuid, ?::user_role)',
                        [uuidv4(), application.user_id, targetRole]
                    );
                }

                // Send notification
                const notificationId = uuidv4();
                await connection.execute(
                    'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?::uuid, ?::uuid, ?, ?, ?)',
                    [notificationId, application.user_id, `${roleLabel} Application Approved! 🎉`, `Congratulations! Your application to become a ${targetRole} has been approved. You now have access to ${targetRole} pricing.`, 'success']
                );

                // Send detailed approval message
                const messageId = uuidv4();
                const userName = application.full_name || 'Valued User';
                await connection.execute(
                    'INSERT INTO messages (id, sender_id, recipient_id, subject, body) VALUES (?::uuid, ?, ?::uuid, ?, ?)',
                    [messageId, 'system', application.user_id, `Welcome to ByteBeacon ${roleLabel} Program! 🎉`, `Dear ${userName},\n\nCongratulations! 🎊\n\nWe are delighted to inform you that your application to become a ByteBeacon ${roleLabel} has been APPROVED!\n\nAs a ${roleLabel}, you now enjoy:\n\n• Exclusive discounted prices on all data bundles\n• Higher profit margins when reselling\n• Priority customer support\n• Access to bulk purchase features\n\nYou can start enjoying ${targetRole} pricing immediately on all your purchases.\n\nThank you for choosing ByteBeacon. We look forward to a successful partnership!\n\n— The ByteBeacon Team`]
                );

                // Emit Socket.IO events
                if (io) {
                    io.to(application.user_id).emit('newNotification', {
                        id: notificationId,
                        title: 'Agent Application Approved! 🎉',
                        message: 'Congratulations! Your agent application has been approved.',
                        type: 'success',
                        isRead: false,
                        createdAt: new Date()
                    });
                    io.to(application.user_id).emit('newMessage', {
                        id: messageId,
                        subject: 'Welcome to ByteBeacon Agent Program! 🎉',
                        senderName: 'ByteBeacon Team',
                        body: 'Congratulations! Your agent application has been approved.',
                        isRead: false,
                        createdAt: new Date()
                    });
                }
            } else if (status === 'rejected' && application) {
                // Send notification
                const notificationId = uuidv4();
                await connection.execute(
                    'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?::uuid, ?::uuid, ?, ?, ?)',
                    [notificationId, application.user_id, 'Agent Application Update', adminNotes || 'Your application to become an agent has been reviewed.', 'warning']
                );

                // Send detailed rejection message
                const messageId = uuidv4();
                const userName = application.full_name || 'Valued User';
                const rejectionReason = adminNotes || 'We appreciate your interest, but we are unable to approve your application at this time.';
                await connection.execute(
                    'INSERT INTO messages (id, sender_id, recipient_id, subject, body) VALUES (?::uuid, ?, ?::uuid, ?, ?)',
                    [messageId, 'system', application.user_id, 'Agent Application Status Update', `Dear ${userName},\n\nThank you for your interest in becoming a ByteBeacon Agent.\n\nAfter careful review, we regret to inform you that we are unable to approve your application at this time.\n\nReason: ${rejectionReason}\n\nYou may reapply in the future if your circumstances change. In the meantime, you can continue enjoying our services as a valued customer.\n\nIf you have any questions, please don't hesitate to reach out to our support team.\n\nBest regards,\n\n— The ByteBeacon Team`]
                );

                // Emit Socket.IO events
                if (io) {
                    io.to(application.user_id).emit('newNotification', {
                        id: notificationId,
                        title: 'Agent Application Update',
                        message: 'Your agent application has been reviewed.',
                        type: 'warning',
                        isRead: false,
                        createdAt: new Date()
                    });
                    io.to(application.user_id).emit('newMessage', {
                        id: messageId,
                        subject: 'Agent Application Status Update',
                        senderName: 'ByteBeacon Team',
                        body: 'Your application has been reviewed. Please check for details.',
                        isRead: false,
                        createdAt: new Date()
                    });
                }
            }

            await connection.commit();

            logActivity(req.user?.id, status === 'approved' ? 'AGENT_APPLICATION_APPROVED' : 'AGENT_APPLICATION_REJECTED', `${status === 'approved' ? 'Approved' : 'Rejected'} agent application for user ${application?.user_id?.slice(0, 8) || id.slice(0, 8)}`, { applicationId: id, userId: application?.user_id, status, adminNotes }, req.ip);

            res.json({ message: `Application ${status} successfully` });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Update agent application error:', error);
        res.status(500).json({ error: 'Failed to update application' });
    }
};
// Get all activity logs for admin (with server-side pagination)
const getActivityLogs = async (req, res) => {
    try {
        const { parsePagination, buildPaginatedResponse } = require('../utils/pagination');
        const { userId, action, search, startDate, endDate } = req.query;
        const { page, limit, offset, sortSql } = parsePagination(req.query, {
            defaultPage: 1,
            defaultLimit: 50,
            maxLimit: 100,
            allowedSortFields: {
                createdAt: 'al.created_at',
                action: 'al.action'
            },
            defaultSort: 'al.created_at DESC'
        });

        let baseFromWhere = `
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id::text = u.uuid::text
            LEFT JOIN profiles p ON al.user_id::text = p.id::text
            LEFT JOIN user_roles ur ON al.user_id::text = ur.user_id::text
            WHERE 1=1
        `;
        const params = [];

        if (userId) {
            baseFromWhere += ' AND al.user_id = ?::uuid';
            params.push(userId);
        }

        if (action && action !== 'all') {
            baseFromWhere += ' AND al.action = ?';
            params.push(action);
        }

        if (search && search.trim() !== '') {
            baseFromWhere += ' AND (p.full_name ILIKE ? OR p.email ILIKE ? OR u.email ILIKE ? OR al.description ILIKE ? OR al.action ILIKE ?)';
            const searchPattern = `%${search.trim()}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        }

        // Date filtering for per-day tracking
        if (startDate) {
            baseFromWhere += ' AND al.created_at::date >= ?::date';
            params.push(startDate);
        }

        if (endDate) {
            baseFromWhere += ' AND al.created_at::date <= ?::date';
            params.push(endDate);
        }

        // 1. Total matching count
        const countQuery = `SELECT COUNT(*) as total ${baseFromWhere}`;
        const [countRows] = await pool.execute(countQuery, params);
        const total = parseInt(countRows[0]?.total || 0, 10);

        // 2. Paginated rows
        const dataQuery = `
            SELECT al.*, 
                   COALESCE(p.full_name, p.email, u.email, 'Admin/User') as full_name, 
                   COALESCE(p.email, u.email, '') as email,
                   COALESCE(ur.role::text, u.role::text, 'customer') as role
            ${baseFromWhere}
            ORDER BY ${sortSql}
            LIMIT ? OFFSET ?
        `;
        const dataParams = [...params, limit, offset];
        const [logs] = await pool.execute(dataQuery, dataParams);

        const formatted = logs.map(log => {
            let parsedMetadata = log.metadata;
            if (typeof log.metadata === 'string') {
                try { parsedMetadata = JSON.parse(log.metadata); } catch (e) { parsedMetadata = null; }
            }
            return {
                id: log.id,
                userId: log.user_id,
                userName: log.full_name || 'Unknown User',
                userEmail: log.email || '',
                userRole: log.role || 'customer',
                action: log.action,
                description: log.description,
                metadata: parsedMetadata,
                ipAddress: log.ip_address,
                createdAt: log.created_at
            };
        });

        if (req.query.legacy === 'true') {
            return res.json(formatted);
        }

        res.json(buildPaginatedResponse(formatted, total, page, limit));
    } catch (error) {
        console.error('Get activity logs error:', error);
        res.status(500).json({ error: 'Failed to get activity logs' });
    }
};

// Get detailed user info (profile, transactions, activity logs)
// Get detailed user info (profile, transactions, activity logs)
const getUserDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        // Get user profile
        const [profiles] = await pool.execute(
            `SELECT u.uuid as id, u.email, u.name as backup_name, u.phone as backup_phone, 
                    p.full_name, p.phone as profile_phone, p.wallet_balance, p.created_at,
                    COALESCE(ur.role::text, u.role::text, 'customer') as role
             FROM users u
             LEFT JOIN profiles p ON u.uuid = p.id::uuid
             LEFT JOIN user_roles ur ON u.uuid = ur.user_id::uuid
             WHERE u.uuid = ?::uuid`,
            [id]
        );

        if (profiles.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = profiles[0];

        // Build date filter conditions if provided
        let txDateCond = '';
        let logDateCond = '';
        let depDateCond = '';
        let refDateCond = '';

        const txParams = [id];
        const logParams = [id];
        const depParams = [id];
        const refParams = [id];

        if (startDate) {
            txDateCond += ` AND t.created_at >= ?::timestamptz`;
            logDateCond += ` AND created_at >= ?::timestamptz`;
            depDateCond += ` AND created_at >= ?::timestamptz`;
            refDateCond += ` AND created_at >= ?::timestamptz`;
            const sDate = `${startDate}T00:00:00.000Z`;
            txParams.push(sDate);
            logParams.push(sDate);
            depParams.push(sDate);
            refParams.push(sDate);
        }

        if (endDate) {
            txDateCond += ` AND t.created_at <= ?::timestamptz`;
            logDateCond += ` AND created_at <= ?::timestamptz`;
            depDateCond += ` AND created_at <= ?::timestamptz`;
            refDateCond += ` AND created_at <= ?::timestamptz`;
            const eDate = `${endDate}T23:59:59.999Z`;
            txParams.push(eDate);
            logParams.push(eDate);
            depParams.push(eDate);
            refParams.push(eDate);
        }

        // 1. Transactions & Total Transaction Count
        let transactions = [];
        let totalTransactions = 0;
        try {
            const [countRows] = await pool.execute(
                `SELECT COUNT(*)::integer as count FROM transactions t WHERE t.user_id = ?::uuid ${txDateCond}`,
                txParams
            );
            totalTransactions = parseInt(countRows[0]?.count) || 0;

            const [txRows] = await pool.execute(
                `SELECT t.id, t.recipient_phone, t.amount_ghc, t.status, t.created_at,
                        db.network, db.data_amount
                 FROM transactions t
                 LEFT JOIN data_bundles db ON t.bundle_id = db.id::uuid
                 WHERE t.user_id = ?::uuid ${txDateCond}
                 ORDER BY t.created_at DESC
                 LIMIT 200`,
                txParams
            );
            transactions = txRows;
        } catch (txErr) {
            console.error('getUserDetails transactions error:', txErr);
        }

        // 2. Activity Logs & Total Activity Count
        let activityLogs = [];
        let totalActivityLogs = 0;
        try {
            const [logCountRows] = await pool.execute(
                `SELECT COUNT(*)::integer as count FROM activity_logs WHERE user_id = ?::uuid ${logDateCond}`,
                logParams
            );
            totalActivityLogs = parseInt(logCountRows[0]?.count) || 0;

            const [logRows] = await pool.execute(
                `SELECT id, action, description, metadata, ip_address, created_at
                 FROM activity_logs
                 WHERE user_id = ?::uuid ${logDateCond}
                 ORDER BY created_at DESC
                 LIMIT 200`,
                logParams
            );
            activityLogs = logRows;
        } catch (logErr) {
            console.error('getUserDetails activityLogs error:', logErr);
        }

        // 3. Deposits & Total Deposits Count
        let deposits = [];
        let totalDeposits = 0;
        try {
            const [depCountRows] = await pool.execute(
                `SELECT COUNT(*)::integer as count FROM deposits WHERE user_id = ?::uuid ${depDateCond}`,
                depParams
            );
            totalDeposits = parseInt(depCountRows[0]?.count) || 0;

            const [depRows] = await pool.execute(
                `SELECT id, amount_ghc, reference, status, created_at
                 FROM deposits
                 WHERE user_id = ?::uuid ${depDateCond}
                 ORDER BY created_at DESC
                 LIMIT 200`,
                depParams
            );
            deposits = depRows;
        } catch (depErr) {
            console.error('getUserDetails deposits error:', depErr);
        }

        // 4. Refunds & Total Refunds Count
        let refunds = [];
        let totalRefundsCount = 0;
        try {
            const [refCountRows] = await pool.execute(
                `SELECT COUNT(*)::integer as count FROM refunds WHERE user_id = ?::uuid ${refDateCond}`,
                refParams
            );
            totalRefundsCount = parseInt(refCountRows[0]?.count) || 0;

            const [refundsList] = await pool.execute(
                `SELECT id, amount_ghc, notes, created_at
                 FROM refunds
                 WHERE user_id = ?::uuid ${refDateCond}
                 ORDER BY created_at DESC
                 LIMIT 200`,
                refParams
            );
            refunds = refundsList;
        } catch (refErr) {
            console.error('getUserDetails refunds error:', refErr);
        }

        // 5. Database Statistics & Financial Aggregation
        let statsData = {
            totalOrders: 0,
            completedOrders: 0,
            failedOrders: 0,
            pendingOrders: 0,
            totalSpent: 0,
            dailySpent: 0,
            dailyOrders: 0,
            dailyRefunds: 0,
            totalRefunds: 0,
            transactionCount: totalTransactions,
            activityCount: totalActivityLogs,
            depositCount: totalDeposits,
            refundCount: totalRefundsCount
        };

        try {
            const [statRows] = await pool.execute(
                `SELECT 
                    COUNT(CASE WHEN status = 'completed' THEN 1 END)::integer as "completedOrders",
                    COUNT(CASE WHEN status = 'failed' THEN 1 END)::integer as "failedOrders",
                    COUNT(CASE WHEN status = 'processing' OR status = 'pending' THEN 1 END)::integer as "pendingOrders",
                    COALESCE(SUM(CASE WHEN status = 'completed' THEN amount_ghc ELSE 0 END), 0)::float as "totalSpent",
                    COUNT(CASE WHEN status = 'completed' AND created_at >= CURRENT_DATE THEN 1 END)::integer as "dailyOrders",
                    COALESCE(SUM(CASE WHEN status = 'completed' AND created_at >= CURRENT_DATE THEN amount_ghc ELSE 0 END), 0)::float as "dailySpent"
                 FROM transactions t
                 WHERE t.user_id = ?::uuid ${txDateCond}`,
                txParams
            );

            if (statRows.length > 0) {
                const s = statRows[0];
                statsData.completedOrders = parseInt(s.completedOrders) || 0;
                statsData.totalOrders = parseInt(s.completedOrders) || 0; // Completed qualifying orders
                statsData.failedOrders = parseInt(s.failedOrders) || 0;
                statsData.pendingOrders = parseInt(s.pendingOrders) || 0;
                statsData.totalSpent = parseFloat(s.totalSpent) || 0;
                statsData.dailyOrders = parseInt(s.dailyOrders) || 0;
                statsData.dailySpent = parseFloat(s.dailySpent) || 0;
            }
        } catch (statErr) {
            console.error('getUserDetails stats error:', statErr);
        }

        try {
            const [refundSumRows] = await pool.execute(
                `SELECT 
                    COALESCE(SUM(amount_ghc), 0)::float as "totalRefunds",
                    COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE THEN amount_ghc ELSE 0 END), 0)::float as "dailyRefunds"
                 FROM refunds
                 WHERE user_id = ?::uuid ${refDateCond}`,
                refParams
            );

            if (refundSumRows.length > 0) {
                statsData.totalRefunds = parseFloat(refundSumRows[0].totalRefunds) || 0;
                statsData.dailyRefunds = parseFloat(refundSumRows[0].dailyRefunds) || 0;
            }
        } catch (refSumErr) {
            console.error('getUserDetails refund sum error:', refSumErr);
        }

        res.json({
            user: {
                id: user.id,
                fullName: user.full_name || user.backup_name || 'User',
                email: user.email,
                phone: user.profile_phone || user.backup_phone || '',
                walletBalance: parseFloat(user.wallet_balance) || 0,
                role: user.role || 'customer',
                createdAt: user.created_at
            },
            transactions: transactions.map(t => ({
                id: t.id,
                recipientPhone: t.recipient_phone,
                amount: parseFloat(t.amount_ghc || 0),
                status: t.status,
                network: t.network || 'N/A',
                dataAmount: t.data_amount || 'N/A',
                createdAt: t.created_at
            })),
            activityLogs: activityLogs.map(log => ({
                id: log.id,
                action: log.action,
                description: log.description,
                metadata: log.metadata,
                ipAddress: log.ip_address,
                createdAt: log.created_at
            })),
            deposits: deposits.map(d => ({
                id: d.id,
                amount: parseFloat(d.amount_ghc || 0),
                reference: d.reference,
                status: d.status,
                createdAt: d.created_at
            })),
            refunds: refunds.map(r => ({
                id: r.id,
                amount: parseFloat(r.amount_ghc || 0),
                notes: r.notes || 'No description',
                createdAt: r.created_at
            })),
            stats: statsData
        });

    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({ error: 'Failed to get user details: ' + error.message });
    }
};

// Get all custom pricing for an agent
const getAgentPricing = async (req, res) => {
    try {
        const { agentId } = req.params;

        const [pricing] = await pool.execute(
            `SELECT ap.id, ap.bundle_id, ap.custom_price, ap.created_at, ap.updated_at,
                    db.network, db.data_amount, db.price_ghc, db.agent_price_ghc
             FROM agent_pricing ap
             JOIN data_bundles db ON ap.bundle_id = db.id
             WHERE ap.agent_id = ?::uuid
             ORDER BY db.network, db.price_ghc`,
            [agentId]
        );

        res.json(pricing.map(p => ({
            id: p.id,
            bundleId: p.bundle_id,
            customPrice: parseFloat(p.custom_price),
            network: p.network,
            dataAmount: p.data_amount,
            standardPrice: parseFloat(p.price_ghc),
            defaultAgentPrice: p.agent_price_ghc ? parseFloat(p.agent_price_ghc) : null,
            createdAt: p.created_at,
            updatedAt: p.updated_at
        })));

    } catch (error) {
        console.error('Get agent pricing error:', error);
        res.status(500).json({ error: 'Failed to get agent pricing' });
    }
};

// Set custom pricing for an agent on a bundle
const setAgentPricing = async (req, res) => {
    try {
        const { agentId } = req.params;
        const { bundleId, customPrice } = req.body;

        if (!bundleId || customPrice === undefined) {
            return res.status(400).json({ error: 'Bundle ID and custom price are required' });
        }

        // Check if pricing already exists
        const [existing] = await pool.execute(
            'SELECT id FROM agent_pricing WHERE agent_id = ?::uuid AND bundle_id = ?::uuid',
            [agentId, bundleId]
        );

        if (existing.length > 0) {
            // Update existing
            await pool.execute(
                'UPDATE agent_pricing SET custom_price = ? WHERE agent_id = ?::uuid AND bundle_id = ?::uuid',
                [customPrice, agentId, bundleId]
            );
        } else {
            // Create new
            const id = require('uuid').v4();
            await pool.execute(
                'INSERT INTO agent_pricing (id, agent_id, bundle_id, custom_price) VALUES (?::uuid, ?::uuid, ?::uuid, ?)',
                [id, agentId, bundleId, customPrice]
            );
        }

        res.json({ message: 'Agent pricing updated successfully' });

    } catch (error) {
        console.error('Set agent pricing error:', error);
        res.status(500).json({ error: 'Failed to set agent pricing' });
    }
};

// Delete custom pricing for an agent on a bundle
const deleteAgentPricing = async (req, res) => {
    try {
        const { agentId, bundleId } = req.params;

        await pool.execute(
            'DELETE FROM agent_pricing WHERE agent_id = ?::uuid AND bundle_id = ?::uuid',
            [agentId, bundleId]
        );

        res.json({ message: 'Agent pricing deleted successfully' });

    } catch (error) {
        console.error('Delete agent pricing error:', error);
        res.status(500).json({ error: 'Failed to delete agent pricing' });
    }
};

// Bulk set custom pricing for an agent
const bulkSetAgentPricing = async (req, res) => {
    try {
        const { agentId } = req.params;
        const { pricing } = req.body; // Array of { bundleId, customPrice }

        if (!Array.isArray(pricing)) {
            return res.status(400).json({ error: 'Pricing must be an array' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            for (const item of pricing) {
                if (!item.bundleId || item.customPrice === undefined) continue;

                const [existing] = await connection.execute(
                    'SELECT id FROM agent_pricing WHERE agent_id = ?::uuid AND bundle_id = ?::uuid',
                    [agentId, item.bundleId]
                );

                if (existing.length > 0) {
                    await connection.execute(
                        'UPDATE agent_pricing SET custom_price = ? WHERE agent_id = ?::uuid AND bundle_id = ?::uuid',
                        [item.customPrice, agentId, item.bundleId]
                    );
                } else {
                    const id = require('uuid').v4();
                    await connection.execute(
                        'INSERT INTO agent_pricing (id, agent_id, bundle_id, custom_price) VALUES (?::uuid, ?::uuid, ?::uuid, ?)',
                        [id, agentId, item.bundleId, item.customPrice]
                    );
                }
            }

            await connection.commit();
            res.json({ message: 'Agent pricing updated successfully' });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Bulk set agent pricing error:', error);
        res.status(500).json({ error: 'Failed to set agent pricing' });
    }
};

// Get all wallet credit requests for admin
const getWalletCreditRequests = async (req, res) => {
    try {
        const { status } = req.query;

        let query = `
            SELECT wcr.*, p.full_name, p.email, p.phone
            FROM wallet_credit_requests wcr
            JOIN profiles p ON wcr.user_id = p.id
        `;
        const params = [];

        if (status && status !== 'all') {
            query += ' WHERE wcr.status = ?';
            params.push(status);
        }

        query += ' ORDER BY wcr.created_at DESC';

        const [requests] = await pool.execute(query, params);

        const formatted = requests.map(reqItem => ({
            id: reqItem.id,
            userId: reqItem.user_id,
            fullName: reqItem.full_name,
            email: reqItem.email,
            phone: reqItem.phone,
            amount: parseFloat(reqItem.amount),
            status: reqItem.status,
            adminNotes: reqItem.admin_notes,
            agentNotes: reqItem.agent_notes,
            createdAt: reqItem.created_at,
            updatedAt: reqItem.updated_at
        }));

        res.json(formatted);
    } catch (error) {
        console.error('Get wallet credit requests error:', error);
        res.status(500).json({ error: 'Failed to get wallet credit requests' });
    }
};

// Update agent wallet credit request (approve/reject)
const updateWalletCreditRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNotes } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Get current request details and lock the row
            const [requests] = await connection.execute(
                'SELECT user_id, amount, status FROM wallet_credit_requests WHERE id = ?::uuid FOR UPDATE',
                [id]
            );

            if (requests.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ error: 'Credit request not found' });
            }

            const request = requests[0];

            if (request.status !== 'pending') {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ error: `Request has already been ${request.status}` });
            }

            // Update the request status and notes
            await connection.execute(
                'UPDATE wallet_credit_requests SET status = ?, admin_notes = ?, updated_at = NOW() WHERE id = ?::uuid',
                [status, adminNotes || null, id]
            );

            const amount = parseFloat(request.amount);
            const targetUserId = request.user_id;

            if (status === 'approved') {
                // Increment profiles wallet_balance
                await connection.execute(
                    'UPDATE profiles SET wallet_balance = wallet_balance + ? WHERE id = ?::uuid',
                    [amount, targetUserId]
                );

                // Increment users wallet_balance
                await connection.execute(
                    'UPDATE users SET wallet_balance = wallet_balance + ? WHERE uuid = ?::uuid',
                    [amount, targetUserId]
                );

                // Create a completed deposit log
                const depositId = uuidv4();
                const reference = `CRE-${id.slice(0, 8)}`;
                await connection.execute(
                    'INSERT INTO deposits (id, user_id, amount_ghc, reference, status, created_at) VALUES (?::uuid, ?::uuid, ?, ?, ?, NOW())',
                    [depositId, targetUserId, amount, reference, 'completed']
                );

                // Create notification for user
                const notificationId = uuidv4();
                await connection.execute(
                    'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?::uuid, ?::uuid, ?, ?, ?)',
                    [notificationId, targetUserId, 'Wallet Credited Successfully! 💰', `Your credit request of GHS ${amount.toFixed(2)} has been approved and added to your wallet.`, 'success']
                );

                // Send message to user
                const messageId = uuidv4();
                await connection.execute(
                    'INSERT INTO messages (id, sender_id, recipient_id, subject, body) VALUES (?::uuid, ?, ?::uuid, ?, ?)',
                    [messageId, 'system', targetUserId, 'Wallet Credit Request Approved 💰', `Hello,\n\nWe are pleased to inform you that your request for wallet credit has been APPROVED.\n\nAmount: GHS ${amount.toFixed(2)}\nAdmin Notes: ${adminNotes || 'None'}\n\nYour wallet balance has been updated accordingly.\n\nBest regards,\nByteBeacon Team`]
                );

                // Socket update
                const io = req.app.get('io');
                if (io) {
                    // Fetch new balance to emit
                    const [pRows] = await connection.execute('SELECT wallet_balance FROM profiles WHERE id = ?::uuid', [targetUserId]);
                    const newBal = pRows.length > 0 ? parseFloat(pRows[0].wallet_balance) : 0;
                    
                    io.to(targetUserId).emit('balanceUpdate', { newBalance: newBal });
                    io.to(targetUserId).emit('newNotification', {
                        id: notificationId,
                        title: 'Wallet Credited Successfully! 💰',
                        message: `Your credit request of GHS ${amount.toFixed(2)} has been approved.`,
                        type: 'success',
                        isRead: false,
                        createdAt: new Date()
                    });
                    io.to(targetUserId).emit('newMessage', {
                        id: messageId,
                        subject: 'Wallet Credit Request Approved 💰',
                        senderName: 'ByteBeacon Team',
                        body: `Your credit request of GHS ${amount.toFixed(2)} has been approved.`,
                        isRead: false,
                        createdAt: new Date()
                    });
                }

                // Log admin activity
                logActivity(req.user.id, 'WALLET_FUND', `Approved credit request of GHS ${amount.toFixed(2)} for user ${targetUserId}`, { requestId: id, amount, targetUserId }, req.ip);

            } else if (status === 'rejected') {
                // Create notification for user
                const notificationId = uuidv4();
                await connection.execute(
                    'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?::uuid, ?::uuid, ?, ?, ?)',
                    [notificationId, targetUserId, 'Wallet Credit Request Rejected ❌', `Your credit request of GHS ${amount.toFixed(2)} was rejected. Reason: ${adminNotes || 'No reason provided'}`, 'warning']
                );

                // Send message to user
                const messageId = uuidv4();
                await connection.execute(
                    'INSERT INTO messages (id, sender_id, recipient_id, subject, body) VALUES (?::uuid, ?, ?::uuid, ?, ?)',
                    [messageId, 'system', targetUserId, 'Wallet Credit Request Rejected ❌', `Hello,\n\nWe regret to inform you that your request for wallet credit has been REJECTED.\n\nRequested Amount: GHS ${amount.toFixed(2)}\nReason: ${adminNotes || 'No reason provided'}\n\nPlease contact support if you have any questions.\n\nBest regards,\nByteBeacon Team`]
                );

                // Socket update
                const io = req.app.get('io');
                if (io) {
                    io.to(targetUserId).emit('newNotification', {
                        id: notificationId,
                        title: 'Wallet Credit Request Rejected ❌',
                        message: `Your credit request of GHS ${amount.toFixed(2)} was rejected.`,
                        type: 'warning',
                        isRead: false,
                        createdAt: new Date()
                    });
                    io.to(targetUserId).emit('newMessage', {
                        id: messageId,
                        subject: 'Wallet Credit Request Rejected ❌',
                        senderName: 'ByteBeacon Team',
                        body: `Your credit request of GHS ${amount.toFixed(2)} was rejected.`,
                        isRead: false,
                        createdAt: new Date()
                    });
                }

                // Log admin activity
                logActivity(req.user.id, 'WALLET_FUND', `Rejected credit request of GHS ${amount.toFixed(2)} for user ${targetUserId}`, { requestId: id, amount, targetUserId }, req.ip);
            }

            await connection.commit();
            res.json({ message: `Wallet credit request ${status} successfully` });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Update wallet credit request error:', error);
        res.status(500).json({ error: 'Failed to update credit request' });
    }
};

// Manually credit user's wallet directly
const creditUserWallet = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, action = 'credit', notes } = req.body;

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount)) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }

        if (action === 'set') {
            if (parsedAmount < 0) {
                return res.status(400).json({ error: 'Amount cannot be negative' });
            }
        } else {
            if (parsedAmount <= 0) {
                return res.status(400).json({ error: 'Valid positive amount is required' });
            }
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Verify user exists and fetch current balance
            const [profiles] = await connection.execute(
                'SELECT id, full_name, wallet_balance FROM profiles WHERE id = ?::uuid FOR UPDATE',
                [id]
            );

            if (profiles.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ error: 'User profile not found' });
            }

            const currentBalance = parseFloat(profiles[0].wallet_balance) || 0;
            let delta = 0;
            let activityMsg = '';
            let notifTitle = '';
            let notifMsg = '';
            let msgSubject = '';
            let msgBody = '';

            if (action === 'debit') {
                delta = -parsedAmount;
                activityMsg = `Manually debited GHS ${parsedAmount.toFixed(2)} from user ${id}`;
                notifTitle = 'Wallet Debited Manually! 💸';
                notifMsg = `An administrator has manually debited your wallet by GHS ${parsedAmount.toFixed(2)}. Notes: ${notes || 'None'}`;
                msgSubject = 'Wallet Debited Manually 💸';
                msgBody = `Hello,\n\nWe want to inform you that your wallet has been manually debited by an administrator.\n\nDebited Amount: GHS ${parsedAmount.toFixed(2)}\nNotes: ${notes || 'None'}\n\nYour new wallet balance is now updated.\n\nBest regards,\nByteBeacon Team`;
            } else if (action === 'set') {
                delta = parsedAmount - currentBalance;
                activityMsg = `Manually set user ${id}'s wallet balance to GHS ${parsedAmount.toFixed(2)} (was GHS ${currentBalance.toFixed(2)})`;
                notifTitle = 'Wallet Balance Adjusted! 💰';
                notifMsg = `An administrator has manually set your wallet balance to GHS ${parsedAmount.toFixed(2)}. Notes: ${notes || 'None'}`;
                msgSubject = 'Wallet Balance Adjusted 💰';
                msgBody = `Hello,\n\nWe want to inform you that your wallet balance has been manually set by an administrator.\n\nNew Wallet Balance: GHS ${parsedAmount.toFixed(2)}\nPrevious Balance: GHS ${currentBalance.toFixed(2)}\nNotes: ${notes || 'None'}\n\nBest regards,\nByteBeacon Team`;
            } else if (action === 'refund') {
                delta = parsedAmount;
                activityMsg = `Manually refunded GHS ${parsedAmount.toFixed(2)} to user ${id}`;
                notifTitle = 'Wallet Refunded! 💰';
                notifMsg = `An administrator has refunded your wallet with GHS ${parsedAmount.toFixed(2)}. Notes: ${notes || 'None'}`;
                msgSubject = 'Wallet Refunded 💰';
                msgBody = `Hello,\n\nWe want to inform you that your wallet has been credited with a refund of GHS ${parsedAmount.toFixed(2)}.\n\nRefund Amount: GHS ${parsedAmount.toFixed(2)}\nNotes: ${notes || 'None'}\n\nYour new wallet balance is now updated.\n\nBest regards,\nByteBeacon Team`;
            } else {
                // credit
                delta = parsedAmount;
                activityMsg = `Manually credited GHS ${parsedAmount.toFixed(2)} to user ${id}`;
                notifTitle = 'Wallet Credited Manually! 💰';
                notifMsg = `An administrator has manually credited your wallet with GHS ${parsedAmount.toFixed(2)}. Notes: ${notes || 'None'}`;
                msgSubject = 'Wallet Credited Manually 💰';
                msgBody = `Hello,\n\nWe want to inform you that your wallet has been manually credited by an administrator.\n\nCredited Amount: GHS ${parsedAmount.toFixed(2)}\nNotes: ${notes || 'None'}\n\nYour new wallet balance is now updated.\n\nBest regards,\nByteBeacon Team`;
            }

            if (action === 'set') {
                // Update profiles wallet_balance directly
                await connection.execute(
                    'UPDATE profiles SET wallet_balance = ? WHERE id = ?::uuid',
                    [parsedAmount, id]
                );

                // Update users wallet_balance directly
                await connection.execute(
                    'UPDATE users SET wallet_balance = ? WHERE uuid = ?::uuid',
                    [parsedAmount, id]
                );
            } else {
                // Update profiles wallet_balance
                await connection.execute(
                    'UPDATE profiles SET wallet_balance = wallet_balance + ? WHERE id = ?::uuid',
                    [delta, id]
                );

                // Update users wallet_balance
                await connection.execute(
                    'UPDATE users SET wallet_balance = wallet_balance + ? WHERE uuid = ?::uuid',
                    [delta, id]
                );
            }

            // Create completed deposit record
            const depositId = uuidv4();
            const reference = action === 'refund' ? `REF-${uuidv4().slice(0, 8)}` : `MAN-${uuidv4().slice(0, 8)}`;
            await connection.execute(
                'INSERT INTO deposits (id, user_id, amount_ghc, reference, status, created_at) VALUES (?::uuid, ?::uuid, ?, ?, ?, NOW())',
                [depositId, id, delta, reference, 'completed']
            );

            // If action is refund, also insert into refunds table
            if (action === 'refund') {
                await connection.execute(
                    'INSERT INTO refunds (id, user_id, amount_ghc, notes) VALUES (?::uuid, ?::uuid, ?, ?)',
                    [uuidv4(), id, parsedAmount, notes || 'Manual admin refund']
                );
            }

            // Create notification for target user
            const notificationId = uuidv4();
            await connection.execute(
                'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?::uuid, ?::uuid, ?, ?, ?)',
                [notificationId, id, notifTitle, notifMsg, action === 'debit' ? 'warning' : 'success']
            );

            // Send system message
            const messageId = uuidv4();
            await connection.execute(
                'INSERT INTO messages (id, sender_id, recipient_id, subject, body) VALUES (?::uuid, ?, ?::uuid, ?, ?)',
                [messageId, 'system', id, msgSubject, msgBody]
            );

            const io = req.app.get('io') || global.io;
            if (io) {
                const [pRows] = await connection.execute('SELECT wallet_balance FROM profiles WHERE id = ?::uuid', [id]);
                const newBal = pRows.length > 0 ? parseFloat(pRows[0].wallet_balance) : 0;
                
                const balancePayload = { userId: id, newBalance: newBal, walletBalance: newBal };
                io.to(id).emit('balanceUpdate', balancePayload);
                io.to('admins').emit('balanceUpdate', balancePayload);
                io.emit('balanceUpdate', balancePayload);

                if (action === 'refund') {
                    const refundPayload = {
                        userId: id,
                        refundId: uuidv4(),
                        amount: parsedAmount,
                        notes: notes || 'Manual admin refund',
                        createdAt: new Date().toISOString()
                    };
                    io.to(id).emit('newRefund', refundPayload);
                    io.to('admins').emit('newRefund', refundPayload);
                    io.emit('newRefund', refundPayload);
                }

                const depositPayload = {
                    userId: id,
                    depositId,
                    amount: delta,
                    reference,
                    status: 'completed',
                    createdAt: new Date().toISOString()
                };
                io.to(id).emit('newDeposit', depositPayload);
                io.to('admins').emit('newDeposit', depositPayload);
                io.emit('newDeposit', depositPayload);

                io.to(id).emit('newNotification', {
                    id: notificationId,
                    title: notifTitle,
                    message: notifMsg,
                    type: action === 'debit' ? 'warning' : 'success',
                    isRead: false,
                    createdAt: new Date()
                });

                io.emit('userStatsUpdate', { userId: id });
            }

            // Log activity
            logActivity(req.user.id, action === 'refund' ? 'REFUND' : 'WALLET_FUND', activityMsg, { amount: parsedAmount, delta, targetUserId: id, action, notes }, req.ip);

            await connection.commit();
            res.json({
                success: true,
                message: action === 'debit' ? 'Wallet debited successfully' : action === 'set' ? 'Wallet balance set successfully' : action === 'refund' ? 'Wallet refunded successfully' : 'Wallet credited successfully',
                newBalance: currentBalance + delta
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Credit user wallet error:', error);
        res.status(500).json({ error: 'Failed to credit user wallet' });
    }
};

// Admin Partner Endpoints
const createPartner = async (req, res) => {
    try {
        const {
            businessName, contactName, email, phone,
            creditEnabled = false, creditLimit = 0.00,
            allowUnlimitedPurchases = false, settlementFrequency = 'daily',
            ipWhitelist = null, webhookUrl = null,
            rateLimitRpm = 60, rateLimitRph = 1000, rateLimitRpd = 10000,
            userId = null
        } = req.body;

        if (!businessName || !email) {
            return res.status(400).json({ error: 'Business name and email are required' });
        }

        if (webhookUrl) {
            const isUrlSafe = await validateWebhookUrl(webhookUrl);
            if (!isUrlSafe) {
                return res.status(400).json({ error: 'Webhook URL must be a valid, public URL.' });
            }
        }

        const crypto = require('crypto');
        // Generate secure live and test key/secret credentials
        const apiKey = 'bb_live_' + crypto.randomBytes(24).toString('hex');
        const plainSecret = 'bb_live_sec_' + crypto.randomBytes(32).toString('hex');

        const testApiKey = 'bb_test_' + crypto.randomBytes(24).toString('hex');
        const plainTestSecret = 'bb_test_sec_' + crypto.randomBytes(32).toString('hex');

        const { encrypted, iv, authTag } = encryptSecret(plainSecret);
        const { encrypted: testEncrypted, iv: testIv, authTag: testAuthTag } = encryptSecret(plainTestSecret);

        const partnerId = uuidv4();
        await pool.execute(
            `INSERT INTO partners (
                id, user_id, business_name, contact_name, email, phone, 
                api_key, api_secret_encrypted, api_secret_iv, api_secret_auth_tag,
                test_api_key, test_api_secret_encrypted, test_api_secret_iv, test_api_secret_auth_tag,
                status, credit_enabled, credit_limit, allow_unlimited_purchases, settlement_frequency, 
                ip_whitelist, webhook_url, rate_limit_rpm, rate_limit_rph, rate_limit_rpd
             ) VALUES (?::uuid, ?::uuid, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ? )`,
            [
                partnerId, userId || null, businessName, contactName || null, email, phone || null,
                apiKey, encrypted, iv, authTag,
                testApiKey, testEncrypted, testIv, testAuthTag,
                creditEnabled, creditLimit, allowUnlimitedPurchases, settlementFrequency,
                ipWhitelist || null, webhookUrl || null, rateLimitRpm, rateLimitRph, rateLimitRpd
            ]
        );

        res.status(201).json({
            message: 'Partner created successfully',
            partnerId,
            apiKey,
            apiSecret: plainSecret,
            testApiKey,
            testApiSecret: plainTestSecret,
            businessName,
            email
        });
    } catch (err) {
        console.error('Create partner error:', err);
        res.status(500).json({ error: 'Failed to create partner: ' + err.message });
    }
};

const getAllPartners = async (req, res) => {
    try {
        const [partners] = await pool.execute('SELECT id, user_id, business_name, contact_name, email, phone, api_key, test_api_key, status, wallet_balance, credit_enabled, credit_limit, allow_unlimited_purchases, outstanding_balance, settlement_frequency, ip_whitelist, webhook_url, rate_limit_rpm, rate_limit_rph, rate_limit_rpd, created_at FROM partners ORDER BY created_at DESC');
        res.json(partners);
    } catch (err) {
        console.error('Get partners error:', err);
        res.status(500).json({ error: 'Failed to retrieve partners' });
    }
};

const getPartnerDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const [partners] = await pool.execute('SELECT id, user_id, business_name, contact_name, email, phone, api_key, test_api_key, status, wallet_balance, credit_enabled, credit_limit, allow_unlimited_purchases, outstanding_balance, settlement_frequency, ip_whitelist, webhook_url, rate_limit_rpm, rate_limit_rph, rate_limit_rpd, created_at FROM partners WHERE id = ?::uuid', [id]);
        
        if (partners.length === 0) {
            return res.status(404).json({ error: 'Partner not found' });
        }

        const [ledger] = await pool.execute('SELECT * FROM partner_ledger WHERE partner_id = ?::uuid ORDER BY created_at DESC LIMIT 50', [id]);
        const [webhooks] = await pool.execute('SELECT id, transaction_id, webhook_url, attempt, status, response_code, created_at FROM partner_webhook_logs WHERE partner_id = ?::uuid ORDER BY created_at DESC LIMIT 50', [id]);

        res.json({
            partner: partners[0],
            ledger,
            webhooks
        });
    } catch (err) {
        console.error('Get partner details error:', err);
        res.status(500).json({ error: 'Failed to retrieve partner details' });
    }
};

const updatePartner = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            businessName, contactName, email, phone, status,
            creditEnabled, creditLimit, allowUnlimitedPurchases, settlementFrequency,
            ipWhitelist, webhookUrl, rateLimitRpm, rateLimitRph, rateLimitRpd, userId
        } = req.body;

        if (webhookUrl) {
            const isUrlSafe = await validateWebhookUrl(webhookUrl);
            if (!isUrlSafe) {
                return res.status(400).json({ error: 'Webhook URL must be a valid, public URL.' });
            }
        }

        await pool.execute(
            `UPDATE partners SET 
                business_name = ?, contact_name = ?, email = ?, phone = ?, status = ?,
                credit_enabled = ?, credit_limit = ?, allow_unlimited_purchases = ?, settlement_frequency = ?,
                ip_whitelist = ?, webhook_url = ?, rate_limit_rpm = ?, rate_limit_rph = ?, rate_limit_rpd = ?, 
                user_id = ?::uuid, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?::uuid`,
            [
                businessName, contactName, email, phone, status,
                creditEnabled, creditLimit, allowUnlimitedPurchases, settlementFrequency,
                ipWhitelist, webhookUrl, rateLimitRpm, rateLimitRph, rateLimitRpd, userId || null,
                id
            ]
        );

        res.json({ message: 'Partner configuration updated successfully' });
    } catch (err) {
        console.error('Update partner error:', err);
        res.status(500).json({ error: 'Failed to update partner: ' + err.message });
    }
};

const adjustPartnerBalance = async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const { type, amount, description } = req.body;

        if (!['credit', 'payment', 'refund', 'adjustment'].includes(type) || isNaN(amount)) {
            return res.status(400).json({ error: 'Invalid adjust parameters.' });
        }

        const change = parseFloat(amount);

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [locked] = await connection.execute('SELECT * FROM partners WHERE id = ?::uuid FOR UPDATE', [id]);
        if (locked.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ error: 'Partner not found.' });
        }

        const partner = locked[0];

        if (partner.credit_enabled || partner.allow_unlimited_purchases) {
            let debtChange = change;
            if (type === 'payment' || type === 'credit' || type === 'refund') {
                debtChange = -Math.abs(change);
            }
            
            await connection.execute(
                'UPDATE partners SET outstanding_balance = outstanding_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                [debtChange, id]
            );

            await connection.execute(
                `INSERT INTO partner_ledger (partner_id, type, amount, description)
                 VALUES (?::uuid, ?, ?, ?)`,
                [id, type, debtChange, description || `Admin ${type} adjustment of ₵${change.toFixed(2)}`]
            );
        } else {
            let walletChange = change;
            if (type === 'payment' || type === 'credit' || type === 'refund') {
                walletChange = Math.abs(change);
            }

            await connection.execute(
                'UPDATE partners SET wallet_balance = wallet_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                [walletChange, id]
            );

            await connection.execute(
                `INSERT INTO partner_ledger (partner_id, type, amount, description)
                 VALUES (?::uuid, ?, ?, ?)`,
                [id, type, -walletChange, description || `Admin ${type} adjustment of ₵${change.toFixed(2)}`]
            );
        }

        await connection.commit();
        connection.release();

        res.json({ message: 'Partner balance adjusted successfully.' });
    } catch (err) {
        if (connection) {
            await connection.rollback().catch(() => {});
            connection.release();
        }
        console.error('Adjust partner balance error:', err);
        res.status(500).json({ error: 'Failed to adjust balance: ' + err.message });
    }
};

// ──────────────────────────────────────────────
// Reprocess a single failed transaction
// ──────────────────────────────────────────────
const reprocessTransaction = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;

        await connection.beginTransaction();

        // 1. Lock and fetch the transaction
        const [txRows] = await connection.execute(
            `SELECT t.id, t.user_id, t.partner_id, t.amount_ghc, t.status, t.bundle_id,
                    d.network, d.data_amount, t.recipient_phone
             FROM transactions t
             LEFT JOIN data_bundles d ON t.bundle_id = d.id::uuid
             WHERE t.id = ?::uuid FOR UPDATE OF t`,
            [id]
        );


        if (txRows.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const tx = txRows[0];

        if (tx.status !== 'failed') {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: `Cannot reprocess a transaction with status "${tx.status}". Only failed orders can be reprocessed.` });
        }

        const amount = parseFloat(tx.amount_ghc);

        // 2. ALWAYS deduct from wallet before reprocessing.
        // The original order already failed, and the user was auto-refunded,
        // so their wallet has the money back. We must re-debit before retrying.
        // Even if the refund record is somehow missing, we still deduct to prevent
        // the user from getting a second free refund if the retry also fails.
        if (tx.user_id) {
            // Lock and check user wallet
            const [profileRows] = await connection.execute(
                'SELECT wallet_balance FROM profiles WHERE id = ?::uuid FOR UPDATE',
                [tx.user_id]
            );
            const currentBalance = profileRows.length > 0 ? parseFloat(profileRows[0].wallet_balance) : 0;

            if (currentBalance < amount) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    error: `Insufficient wallet balance. Customer has ₵${currentBalance.toFixed(2)} but order costs ₵${amount.toFixed(2)}. Cannot reprocess.`
                });
            }

            // Debit wallet for the retry
            await connection.execute(
                'UPDATE profiles SET wallet_balance = wallet_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                [amount, tx.user_id]
            );
            await connection.execute(
                'UPDATE users SET wallet_balance = wallet_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE uuid = ?::uuid',
                [amount, tx.user_id]
            );
        } else if (tx.partner_id) {
            // Lock and check partner wallet
            const [partnerRows] = await connection.execute(
                'SELECT wallet_balance, credit_enabled, allow_unlimited_purchases FROM partners WHERE id = ?::uuid FOR UPDATE',
                [tx.partner_id]
            );

            if (partnerRows.length > 0) {
                const partner = partnerRows[0];
                if (partner.allow_unlimited_purchases || partner.credit_enabled) {
                    await connection.execute(
                        'UPDATE partners SET outstanding_balance = outstanding_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                        [amount, tx.partner_id]
                    );
                } else {
                    const partnerBalance = parseFloat(partner.wallet_balance);
                    if (partnerBalance < amount) {
                        await connection.rollback();
                        connection.release();
                        return res.status(400).json({
                            error: `Insufficient partner wallet balance. Partner has ₵${partnerBalance.toFixed(2)} but order costs ₵${amount.toFixed(2)}.`
                        });
                    }
                    await connection.execute(
                        'UPDATE partners SET wallet_balance = wallet_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?::uuid',
                        [amount, tx.partner_id]
                    );
                }
            }
        }

        // 3. Reset transaction state for reprocessing
        await connection.execute(
            `UPDATE transactions SET 
                status = 'processing', 
                retry_count = 0, 
                next_retry_at = CURRENT_TIMESTAMP, 
                failure_reason = NULL,
                api_response = NULL,
                updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?::uuid`,
            [id]
        );

        await connection.commit();
        connection.release();

        // 4. Log activity
        logActivity(req.user.id, 'ADMIN_REPROCESS', `Admin reprocessed failed transaction ${id.slice(0, 8)}`, { transactionId: id, amountDebited: amount }, req.ip);

        // 5. Emit real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('transactionUpdate', { transactionId: id, status: 'processing', message: 'Order has been requeued for processing with DataHouse.' });
        }

        // 6. Trigger status reconciliation with DataHouse
        const { syncPendingTransactions } = require('../jobs/statusSync');
        syncPendingTransactions(io).catch(err => console.error('DataHouse sync error after reprocess:', err));

        res.json({ message: `Transaction requeued for processing. ₵${amount.toFixed(2)} deducted from wallet.`, status: 'processing', amountDebited: amount });

    } catch (err) {
        if (connection) {
            await connection.rollback().catch(() => {});
            connection.release();
        }
        console.error('Reprocess transaction error:', err);
        res.status(500).json({ error: 'Failed to reprocess transaction: ' + err.message });
    }
};

// ──────────────────────────────────────────────
// Mass reprocess all failed transactions
// ──────────────────────────────────────────────
const massReprocessFailedTransactions = async (req, res) => {
    try {
        // 1. Count failed transactions
        const [[countRow]] = await pool.execute(
            "SELECT COUNT(*) as cnt FROM transactions WHERE status = 'failed'"
        );
        const failedCount = parseInt(countRow.cnt, 10);

        if (failedCount === 0) {
            return res.json({ message: 'No failed transactions to reprocess.', count: 0 });
        }

        // 2. Reset all failed transactions for reprocessing
        await pool.execute(
            `UPDATE transactions SET 
                status = 'processing', 
                retry_count = 0, 
                next_retry_at = CURRENT_TIMESTAMP, 
                failure_reason = NULL,
                api_response = NULL,
                updated_at = CURRENT_TIMESTAMP 
             WHERE status = 'failed'`
        );

        // 3. Log activity
        logActivity(req.user.id, 'ADMIN_MASS_REPROCESS', `Admin mass-reprocessed ${failedCount} failed transaction(s)`, { count: failedCount }, req.ip);

        // 4. Emit real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('transactionUpdate', { status: 'processing', message: `${failedCount} failed orders have been requeued for processing.` });
        }

        // 5. Trigger DataHouse status reconciliation
        const { syncPendingTransactions } = require('../jobs/statusSync');
        syncPendingTransactions(io).catch(err => console.error('DataHouse sync error after mass reprocess:', err));

        res.json({ message: `${failedCount} failed transaction(s) requeued for processing.`, count: failedCount });

    } catch (error) {
        console.error('Mass reprocess error:', error);
        res.status(500).json({ error: 'Failed to mass reprocess transactions: ' + error.message });
    }
};

// =============================================
// AGENT STORE & RESELLER MARKETPLACE ADMIN CONTROLLERS
// =============================================

const getAllAgentStores = async (req, res) => {
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

        const formatted = stores.map(s => {
            let effectiveStatus = 'PENDING';
            if (s.is_visible === false) effectiveStatus = 'INACTIVE';
            else if (s.review_status === 'SUSPENDED') effectiveStatus = 'SUSPENDED';
            else if (s.review_status === 'REJECTED') effectiveStatus = 'REJECTED';
            else if (s.review_status === 'CHANGES_REQUESTED') effectiveStatus = 'CHANGES_REQUESTED';
            else if (s.review_status === 'PENDING_REVIEW') effectiveStatus = 'PENDING';
            else if (s.review_status === 'APPROVED' && s.activation_status === 'PAID') effectiveStatus = 'ACTIVE';
            else if (s.review_status === 'APPROVED' && s.activation_status !== 'PAID') effectiveStatus = 'APPROVED';

            return {
                id: s.id,
                userId: s.user_id,
                storeName: s.store_name,
                slug: s.slug,
                description: s.description,
                phone: s.phone,
                logoUrl: s.logo_url,
                reviewStatus: s.review_status,
                activationStatus: s.activation_status,
                effectiveStatus,
                adminNotes: s.admin_notes,
                isVisible: s.is_visible,
                createdAt: s.created_at,
                updatedAt: s.updated_at,
                userName: s.owner_name,
                userEmail: s.owner_email,
                totalOrders: s.total_orders,
                totalRevenue: parseFloat(s.total_profit_earned || 0),
                // Snake_case aliases for frontend component compatibility
                store_name: s.store_name,
                owner_name: s.owner_name,
                owner_email: s.owner_email,
                review_status: s.review_status,
                activation_status: s.activation_status,
                effective_status: effectiveStatus,
                is_visible: s.is_visible,
                total_orders: s.total_orders,
                total_profit_earned: parseFloat(s.total_profit_earned || 0)
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('Error getting all agent stores:', error);
        res.status(500).json({ error: 'Failed to fetch agent stores: ' + error.message });
    }
};

const updateAgentStoreReviewStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { review_status, admin_notes, is_visible } = req.body;

        const validStatuses = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'SUSPENDED', 'INACTIVE'];
        if (!validStatuses.includes(review_status)) {
            return res.status(400).json({ error: 'Invalid review status' });
        }

        const [stores] = await pool.execute('SELECT user_id, store_name FROM agent_stores WHERE id = ?::uuid', [id]);
        if (stores.length === 0) return res.status(404).json({ error: 'Store not found' });
        const store = stores[0];

        // Handle INACTIVE toggle
        let newReviewStatus = review_status;
        let newIsVisible = is_visible !== undefined ? is_visible : true;

        if (review_status === 'INACTIVE') {
            newIsVisible = false;
        } else if (review_status === 'APPROVED') {
            newIsVisible = true;
        }

        if (review_status !== 'INACTIVE') {
            await pool.execute(
                `UPDATE agent_stores 
                 SET review_status = ?, is_visible = ?, admin_notes = COALESCE(?, admin_notes), updated_at = NOW() 
                 WHERE id = ?::uuid`,
                [newReviewStatus, newIsVisible, admin_notes || null, id]
            );
        } else {
            await pool.execute(
                `UPDATE agent_stores 
                 SET is_visible = FALSE, admin_notes = COALESCE(?, admin_notes), updated_at = NOW() 
                 WHERE id = ?::uuid`,
                [admin_notes || null, id]
            );
        }

        // Send in-app notification to Agent user
        const notifTitle = `Store Status Update: ${review_status}`;
        const notifMessage = `Your Agent Store "${store.store_name}" status has been updated to ${review_status}.${admin_notes ? ' Note: ' + admin_notes : ''}`;
        await pool.execute(
            `INSERT INTO notifications (id, user_id, title, message, type, created_at)
             VALUES (?::uuid, ?::uuid, ?, ?, 'info', NOW())`,
            [uuidv4(), store.user_id, notifTitle, notifMessage]
        ).catch(() => {});

        const storeAction = review_status === 'APPROVED' ? 'AGENT_STORE_APPROVED' : (review_status === 'REJECTED' ? 'AGENT_STORE_REJECTED' : 'AGENT_STORE_STATUS_UPDATED');
        logActivity(req.user?.id, storeAction, `Updated Agent Store "${store.store_name}" status to ${review_status}`, { storeId: id, storeName: store.store_name, review_status, admin_notes }, req.ip);

        res.json({ message: `Store status updated to ${review_status}` });
    } catch (error) {
        console.error('Error updating store review status:', error);
        res.status(500).json({ error: 'Failed to update store status' });
    }
};

const manualActivateAgentStore = async (req, res) => {
    try {
        const { id } = req.params;

        const [stores] = await pool.execute('SELECT user_id, store_name FROM agent_stores WHERE id = ?::uuid', [id]);
        if (stores.length > 0) {
            const userId = stores[0].user_id;
            await pool.execute(`UPDATE users SET role = 'agent'::user_role WHERE uuid = ?::uuid`, [userId]).catch(() => {});
            await pool.execute(`UPDATE user_roles SET role = 'agent'::user_role WHERE user_id = ?::uuid`, [userId]).catch(() => {});

            // Send notification
            await pool.execute(
                `INSERT INTO notifications (id, user_id, title, message, type, created_at)
                 VALUES (?::uuid, ?::uuid, 'Agent Store Activated! 🎉', ?, 'success', NOW())`,
                [uuidv4(), userId, `Your Agent Store "${stores[0].store_name}" has been activated by Admin. You are now live and can begin selling data!`]
            ).catch(() => {});
        }

        await pool.execute(
            `UPDATE agent_stores SET review_status = 'APPROVED', activation_status = 'PAID', is_visible = TRUE, updated_at = NOW() WHERE id = ?::uuid`,
            [id]
        );

        logActivity(req.user?.id, 'AGENT_STORE_ACTIVATED', `Manually activated Agent Store ${id.slice(0, 8)}`, { storeId: id }, req.ip);

        res.json({ message: 'Store activation status manually marked as PAID & APPROVED. Store is now ACTIVE.' });
    } catch (error) {
        console.error('Error manually activating store:', error);
        res.status(500).json({ error: 'Failed to activate store' });
    }
};

const deleteAgentStore = async (req, res) => {
    try {
        const { id } = req.params;

        const [stores] = await pool.execute('SELECT user_id, store_name FROM agent_stores WHERE id = ?::uuid', [id]);
        if (stores.length === 0) {
            return res.status(404).json({ error: 'Store not found' });
        }
        const store = stores[0];

        await pool.execute('DELETE FROM agent_stores WHERE id = ?::uuid', [id]);

        logActivity(req.user?.id, 'AGENT_STORE_DELETED', `Deleted Agent Store "${store.store_name}"`, { storeId: id, storeName: store.store_name }, req.ip);

        res.json({ message: `Agent Store "${store.store_name}" deleted successfully` });
    } catch (error) {
        console.error('Error deleting agent store:', error);
        res.status(500).json({ error: 'Failed to delete agent store: ' + error.message });
    }
};

const getAllAgentWithdrawals = async (req, res) => {
    try {
        const [withdrawals] = await pool.execute(`
            SELECT w.*, 
                   s.store_name,
                   COALESCE(p.full_name, p.email, u.email) as agent_name,
                   COALESCE(p.email, u.email) as agent_email
            FROM agent_withdrawals w
            LEFT JOIN agent_stores s ON w.store_id = s.id
            LEFT JOIN users u ON w.agent_id = u.uuid
            LEFT JOIN profiles p ON w.agent_id = p.id
            ORDER BY w.created_at DESC
        `);

        res.json(withdrawals);
    } catch (error) {
        console.error('Error getting all agent withdrawals:', error);
        res.status(500).json({ error: 'Failed to fetch agent withdrawals' });
    }
};

const updateAgentWithdrawalStatus = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const { status, admin_notes } = req.body;

        if (!['REQUESTED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid withdrawal status' });
        }

        const [rows] = await connection.execute('SELECT * FROM agent_withdrawals WHERE id = ?::uuid', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Withdrawal not found' });
        const withdrawal = rows[0];

        await connection.beginTransaction();

        await connection.execute(
            `UPDATE agent_withdrawals SET status = ?, admin_notes = COALESCE(?, admin_notes), updated_at = NOW() WHERE id = ?::uuid`,
            [status, admin_notes, id]
        );

        // If status changed to FAILED and was previously not failed, refund the deducted amount back to available balance
        if (status === 'FAILED' && withdrawal.status !== 'FAILED') {
            const refundAmount = parseFloat(withdrawal.amount_ghc);

            const [wallets] = await connection.execute('SELECT available_balance FROM agent_wallets WHERE agent_id = ?::uuid', [withdrawal.agent_id]);
            const currentAvail = wallets.length > 0 ? parseFloat(wallets[0].available_balance) : 0.00;
            const newAvail = currentAvail + refundAmount;

            await connection.execute(
                `UPDATE agent_wallets 
                 SET available_balance = available_balance + ?,
                     total_withdrawn = GREATEST(0.00, total_withdrawn - ?),
                     updated_at = NOW()
                 WHERE agent_id = ?::uuid`,
                [refundAmount, refundAmount, withdrawal.agent_id]
            );

            await connection.execute(
                `INSERT INTO agent_wallet_ledger (id, agent_id, store_id, type, amount_ghc, balance_after, description, reference, created_at)
                 VALUES (?::uuid, ?::uuid, ?::uuid, 'REFUND', ?, ?, ?, ?, NOW())`,
                [uuidv4(), withdrawal.agent_id, withdrawal.store_id, refundAmount, newAvail, `Refund for rejected withdrawal request`, id]
            );
        }

        await connection.commit();

        logActivity(req.user?.id, 'WITHDRAWAL_STATUS_CHANGED', `Updated agent withdrawal request ${id.slice(0, 8)} status to ${status}`, { withdrawalId: id, status, amount: withdrawal.amount_ghc, admin_notes }, req.ip);

        res.json({ message: `Withdrawal status updated to ${status}` });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating withdrawal status:', error);
        res.status(500).json({ error: 'Failed to update withdrawal status' });
    } finally {
        if (connection) connection.release();
    }
};

const getAgentPricingRules = async (req, res) => {
    try {
        const [rules] = await pool.execute('SELECT * FROM agent_pricing_rules LIMIT 1');
        res.json(rules[0] || { min_markup_ghc: 0.50, max_markup_ghc: 50.00, min_withdrawal_ghc: 20.00 });
    } catch (error) {
        console.error('Error getting pricing rules:', error);
        res.status(500).json({ error: 'Failed to fetch pricing rules' });
    }
};

const updateAgentPricingRules = async (req, res) => {
    try {
        const { min_markup_ghc, max_markup_ghc, min_withdrawal_ghc } = req.body;

        const [rules] = await pool.execute('SELECT id FROM agent_pricing_rules LIMIT 1');

        if (rules.length > 0) {
            await pool.execute(
                `UPDATE agent_pricing_rules 
                 SET min_markup_ghc = COALESCE(?, min_markup_ghc),
                     max_markup_ghc = COALESCE(?, max_markup_ghc),
                     min_withdrawal_ghc = COALESCE(?, min_withdrawal_ghc),
                     updated_at = NOW()
                 WHERE id = ?::uuid`,
                [min_markup_ghc, max_markup_ghc, min_withdrawal_ghc, rules[0].id]
            );
        } else {
            await pool.execute(
                `INSERT INTO agent_pricing_rules (id, min_markup_ghc, max_markup_ghc, min_withdrawal_ghc, updated_at)
                 VALUES (?::uuid, ?, ?, ?, NOW())`,
                [uuidv4(), min_markup_ghc || 0.50, max_markup_ghc || 50.00, min_withdrawal_ghc || 20.00]
            );
        }

        res.json({ message: 'Pricing rules updated successfully' });
    } catch (error) {
        console.error('Error updating pricing rules:', error);
        res.status(500).json({ error: 'Failed to update pricing rules' });
    }
};

// Export all transactions / orders with active filters (admin)
const exportAllTransactions = async (req, res) => {
    try {
        const { status, network, timeframe, startDate, endDate, search, format = 'csv' } = req.query;

        const safeFormat = ['csv', 'excel', 'xlsx', 'json'].includes(String(format).toLowerCase())
            ? String(format).toLowerCase()
            : 'csv';

        let query = `
            SELECT * FROM (
                SELECT 
                    t.id::text as id, 
                    t.recipient_phone, 
                    t.amount_ghc, 
                    COALESCE(t.current_datahouse_status, t.status) as status, 
                    t.created_at, 
                    t.updated_at,
                    t.serial_id, 
                    t.balance_before, 
                    t.balance_after, 
                    COALESCE(t.source, 'BYTEBEACON') as source, 
                    t.paid, 
                    t.source_provider,
                    t.datahouse_order_id,
                    t.reference_code,
                    t.last_synced_at,
                    t.sync_status,
                    d.network, 
                    d.data_amount,
                    COALESCE(p.full_name, u.name, 'Customer') as user_name, 
                    COALESCE(p.email, u.email, 'N/A') as user_email
                FROM transactions t
                LEFT JOIN data_bundles d ON t.bundle_id::text = d.id::text
                LEFT JOIN users u ON t.user_id::text = u.uuid::text
                LEFT JOIN profiles p ON t.user_id::text = p.id::text

                UNION ALL

                SELECT 
                    o.id::text as id,
                    o.customer_phone as recipient_phone,
                    o.selling_price_ghc as amount_ghc,
                    COALESCE(o.current_datahouse_status, o.fulfillment_status) as status,
                    o.created_at,
                    o.updated_at,
                    NULL as serial_id,
                    NULL as balance_before,
                    NULL as balance_after,
                    'AGENT_STORE' as source,
                    o.payment_status as paid,
                    COALESCE(b.provider_slug, 'datahouse') as source_provider,
                    o.datahouse_order_id,
                    o.reference_code,
                    o.last_synced_at,
                    o.sync_status,
                    o.network,
                    o.data_amount,
                    CONCAT(s.store_name, ' (Storefront)') as user_name,
                    COALESCE(u.email, 'storefront@bytebeacon.online') as user_email
                FROM agent_orders o
                LEFT JOIN agent_stores s ON o.store_id = s.id
                LEFT JOIN users u ON o.agent_id = u.uuid
                LEFT JOIN data_bundles b ON o.bundle_id = b.id::uuid
            ) combined_orders
            WHERE status != 'pending_mtn_approval'
        `;
        const params = [];

        if (status && status !== 'all') {
            query += ' AND LOWER(status) = LOWER(?)';
            params.push(status);
        }

        if (network && network !== 'all') {
            const net = network.toLowerCase();
            if (net === 'mtn') {
                query += " AND LOWER(network) LIKE '%mtn%'";
            } else if (net === 'telecel' || net === 'voda') {
                query += " AND (LOWER(network) LIKE '%telecel%' OR LOWER(network) LIKE '%voda%')";
            } else if (net === 'at' || net === 'airteltigo') {
                query += " AND (LOWER(network) LIKE '%at%' OR LOWER(network) LIKE '%airtel%')";
            } else {
                query += ' AND LOWER(network) LIKE ?';
                params.push(`%${net}%`);
            }
        }

        if (timeframe && timeframe !== 'all') {
            if (timeframe === 'today') {
                query += ' AND created_at >= CURRENT_DATE';
            } else {
                let intervalDays = 0;
                if (timeframe === '7d' || timeframe === 'week') intervalDays = 7;
                else if (timeframe === '30d' || timeframe === 'month') intervalDays = 30;
                else if (timeframe === '90d') intervalDays = 90;
                else if (timeframe === '1y') intervalDays = 365;

                if (intervalDays > 0) {
                    query += ` AND created_at >= NOW() - (${intervalDays} * INTERVAL '1 day')`;
                }
            }
        }

        if (startDate) {
            query += ' AND created_at >= ?::timestamp';
            params.push(new Date(startDate).toISOString());
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query += ' AND created_at <= ?::timestamp';
            params.push(end.toISOString());
        }

        if (search && search.trim() !== '') {
            const term = `%${search.trim()}%`;
            query += ` AND (
                recipient_phone LIKE ? 
                OR user_name ILIKE ? 
                OR user_email ILIKE ? 
                OR id LIKE ? 
                OR (serial_id IS NOT NULL AND serial_id::text LIKE ?)
                OR source_provider ILIKE ?
                OR datahouse_order_id ILIKE ?
                OR reference_code ILIKE ?
            )`;
            params.push(term, term, term, term, term, term, term, term);
        }

        query += ' ORDER BY created_at DESC LIMIT 50000';

        const [rows] = await pool.execute(query, params);

        const columns = [
            {
                key: 'serial_id',
                label: 'Order ID',
                transform: (r) => r.serial_id ? `ORD-${r.serial_id}` : (r.id ? `ORD-${r.id.slice(0, 8).toUpperCase()}` : 'N/A')
            },
            { key: 'id', label: 'Full Reference ID' },
            { key: 'datahouse_order_id', label: 'DataHouse Order ID' },
            { key: 'reference_code', label: 'DataHouse Reference' },
            { key: 'user_name', label: 'Customer / Store' },
            { key: 'user_email', label: 'Email' },
            { key: 'recipient_phone', label: 'Recipient Phone' },
            { key: 'network', label: 'Network' },
            { key: 'data_amount', label: 'Bundle Size' },
            {
                key: 'amount_ghc',
                label: 'Amount (GH₵)',
                transform: (r) => r.amount_ghc !== null && r.amount_ghc !== undefined ? parseFloat(r.amount_ghc) : 0
            },
            { key: 'status', label: 'Order Status' },
            { key: 'sync_status', label: 'Sync Status' },
            { key: 'source', label: 'Source Channel' },
            { key: 'paid', label: 'Payment Status' },
            { key: 'source_provider', label: 'Fulfillment Provider' },
            {
                key: 'balance_before',
                label: 'Bal. Before (GH₵)',
                transform: (r) => r.balance_before !== null && r.balance_before !== undefined ? parseFloat(r.balance_before) : ''
            },
            {
                key: 'balance_after',
                label: 'Bal. After (GH₵)',
                transform: (r) => r.balance_after !== null && r.balance_after !== undefined ? parseFloat(r.balance_after) : ''
            },
            {
                key: 'created_at',
                label: 'Date Placed',
                transform: (r) => r.created_at ? new Date(r.created_at).toISOString() : ''
            },
            {
                key: 'updated_at',
                label: 'Last Updated',
                transform: (r) => r.updated_at ? new Date(r.updated_at).toISOString() : ''
            }
        ];

        return sendExportResponse(res, {
            data: rows,
            columns,
            filename: 'bytebeacon_admin_orders',
            format: safeFormat,
            sheetName: 'All Orders'
        });

    } catch (error) {
        console.error('Export all transactions error:', error);
        return res.status(500).json({ error: 'Failed to export transactions' });
    }
};

// Export all users (admin)
const exportAllUsers = async (req, res) => {
    try {
        const { role, search, format = 'csv' } = req.query;

        const safeFormat = ['csv', 'excel', 'xlsx', 'json'].includes(String(format).toLowerCase())
            ? String(format).toLowerCase()
            : 'csv';

        let query = `
            SELECT p.id, p.full_name, p.email, p.phone, p.wallet_balance, p.created_at,
                   COALESCE(ur.role, 'customer') as role,
                   s.store_name, s.activation_status as store_status
            FROM profiles p
            LEFT JOIN user_roles ur ON p.id = ur.user_id::uuid
            LEFT JOIN agent_stores s ON p.id = s.user_id::uuid
            WHERE 1=1
        `;
        const params = [];

        if (role && role !== 'all') {
            query += ' AND ur.role = ?::user_role';
            params.push(role);
        }

        if (search) {
            query += ' AND (p.full_name ILIKE ? OR p.email ILIKE ? OR p.phone LIKE ?)';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        query += ' ORDER BY p.created_at DESC LIMIT 50000';

        const [rows] = await pool.execute(query, params);

        const columns = [
            { key: 'id', label: 'User ID' },
            { key: 'full_name', label: 'Full Name' },
            { key: 'email', label: 'Email Address' },
            { key: 'phone', label: 'Phone Number' },
            { key: 'role', label: 'Role' },
            {
                key: 'wallet_balance',
                label: 'Wallet Balance (GH₵)',
                transform: (r) => r.wallet_balance !== null && r.wallet_balance !== undefined ? parseFloat(r.wallet_balance) : 0
            },
            { key: 'store_name', label: 'Storefront Name' },
            { key: 'store_status', label: 'Storefront Status' },
            {
                key: 'created_at',
                label: 'Joined Date',
                transform: (r) => r.created_at ? new Date(r.created_at).toISOString() : ''
            }
        ];

        return sendExportResponse(res, {
            data: rows,
            columns,
            filename: 'bytebeacon_users_list',
            format: safeFormat,
            sheetName: 'Users'
        });
    } catch (error) {
        console.error('Export all users error:', error);
        return res.status(500).json({ error: 'Failed to export users' });
    }
};

// Export all agents (admin)
const exportAllAgents = async (req, res) => {
    try {
        const { search, format = 'csv' } = req.query;

        const safeFormat = ['csv', 'excel', 'xlsx', 'json'].includes(String(format).toLowerCase())
            ? String(format).toLowerCase()
            : 'csv';

        let query = `
            SELECT p.id, p.full_name, p.email, p.phone, p.wallet_balance, p.created_at,
                   COALESCE(ur.role, 'agent') as role,
                   s.store_name, s.slug, s.activation_status,
                   COALESCE(stats.total_orders, 0) as total_orders,
                   COALESCE(stats.total_revenue, 0) as total_revenue
            FROM profiles p
            JOIN user_roles ur ON p.id = ur.user_id::uuid AND ur.role IN ('agent', 'superagent')
            LEFT JOIN agent_stores s ON p.id = s.user_id::uuid
            LEFT JOIN (
                SELECT agent_id, COUNT(*) as total_orders, SUM(selling_price_ghc) as total_revenue
                FROM agent_orders
                WHERE payment_status = 'paid'
                GROUP BY agent_id
            ) stats ON p.id = stats.agent_id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ' AND (p.full_name ILIKE ? OR p.email ILIKE ? OR p.phone LIKE ? OR s.store_name ILIKE ?)';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        query += ' ORDER BY p.created_at DESC LIMIT 50000';

        const [rows] = await pool.execute(query, params);

        const columns = [
            { key: 'id', label: 'Agent ID' },
            { key: 'full_name', label: 'Full Name' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'role', label: 'Role' },
            { key: 'store_name', label: 'Store Name' },
            { key: 'activation_status', label: 'Store Status' },
            {
                key: 'wallet_balance',
                label: 'Wallet Balance (GH₵)',
                transform: (r) => r.wallet_balance !== null && r.wallet_balance !== undefined ? parseFloat(r.wallet_balance) : 0
            },
            { key: 'total_orders', label: 'Total Paid Orders' },
            {
                key: 'total_revenue',
                label: 'Total Revenue (GH₵)',
                transform: (r) => r.total_revenue !== null && r.total_revenue !== undefined ? parseFloat(r.total_revenue) : 0
            },
            {
                key: 'created_at',
                label: 'Registered Date',
                transform: (r) => r.created_at ? new Date(r.created_at).toISOString() : ''
            }
        ];

        return sendExportResponse(res, {
            data: rows,
            columns,
            filename: 'bytebeacon_agents_list',
            format: safeFormat,
            sheetName: 'Agents'
        });
    } catch (error) {
        console.error('Export all agents error:', error);
        return res.status(500).json({ error: 'Failed to export agents' });
    }
};

// Export activity logs (admin)
const exportAllActivityLogs = async (req, res) => {
    try {
        const { userId, action, search, startDate, endDate, format = 'csv' } = req.query;

        const safeFormat = ['csv', 'excel', 'xlsx', 'json'].includes(String(format).toLowerCase())
            ? String(format).toLowerCase()
            : 'csv';

        let query = `
            SELECT al.id, al.user_id, al.action, al.description, al.ip_address, al.created_at,
                   COALESCE(p.full_name, u.name, 'System') as full_name,
                   COALESCE(p.email, u.email, '') as email,
                   ur.role
            FROM activity_logs al
            LEFT JOIN profiles p ON al.user_id = p.id
            LEFT JOIN users u ON al.user_id = u.uuid
            LEFT JOIN user_roles ur ON al.user_id = ur.user_id
            WHERE 1=1
        `;
        const params = [];

        if (userId) {
            query += ' AND al.user_id = ?::uuid';
            params.push(userId);
        }

        if (action && action !== 'all') {
            query += ' AND al.action = ?';
            params.push(action);
        }

        if (search) {
            query += ' AND (p.full_name ILIKE ? OR u.name ILIKE ? OR p.email ILIKE ? OR u.email ILIKE ? OR al.description ILIKE ? OR al.action ILIKE ?)';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        }

        if (startDate) {
            query += ' AND al.created_at::date >= ?::date';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND al.created_at::date <= ?::date';
            params.push(endDate);
        }

        query += ' ORDER BY al.created_at DESC LIMIT 50000';

        const [rows] = await pool.execute(query, params);

        const columns = [
            { key: 'id', label: 'Log ID' },
            { key: 'full_name', label: 'User Name' },
            { key: 'email', label: 'User Email' },
            { key: 'role', label: 'User Role' },
            { key: 'action', label: 'Action' },
            { key: 'description', label: 'Description' },
            { key: 'ip_address', label: 'IP Address' },
            {
                key: 'created_at',
                label: 'Timestamp',
                transform: (r) => r.created_at ? new Date(r.created_at).toISOString() : ''
            }
        ];

        return sendExportResponse(res, {
            data: rows,
            columns,
            filename: 'bytebeacon_activity_logs',
            format: safeFormat,
            sheetName: 'Activity Logs'
        });
    } catch (error) {
        console.error('Export activity logs error:', error);
        return res.status(500).json({ error: 'Failed to export activity logs' });
    }
};

module.exports = {
    createUser,
    getAllUsers,
    exportAllUsers,
    exportAllAgents,
    changeUserRole,
    getAllTransactions,
    exportAllTransactions,
    getTransactionStats,
    updateTransactionStatus,
    createBundle,
    updateBundle,
    deleteBundle,
    getDashboardStats,
    updateUser,
    deleteUser,
    sendNotification,
    getAllNotifications,
    sendEmail,
    getAnalytics,
    sendMessage,
    getMessages,
    getAgentApplications,
    updateAgentApplication,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
    getAllBundles,
    deleteMessage,
    markMessageRead,
    getActivityLogs,
    exportAllActivityLogs,
    getUserDetails,
    getAgentPricing,
    setAgentPricing,
    deleteAgentPricing,
    bulkSetAgentPricing,
    toggleUserStatus,
    getWalletCreditRequests,
    updateWalletCreditRequest,
    creditUserWallet,
    createPartner,
    getAllPartners,
    getPartnerDetails,
    updatePartner,
    adjustPartnerBalance,
    reprocessTransaction,
    massReprocessFailedTransactions,
    getAllAgentStores,
    updateAgentStoreReviewStatus,
    manualActivateAgentStore,
    deleteAgentStore,
    getAllAgentWithdrawals,
    updateAgentWithdrawalStatus,
    getAgentPricingRules,
    updateAgentPricingRules
};

