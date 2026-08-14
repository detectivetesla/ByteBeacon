const pool = require('../config/database');
const datahouse = require('../integrations/datahouse');
const { getAgentProfile, getBundles, getWalletBalance, getBeneficiaries, getOrders } = require('../integrations/datahouse');

async function runPhase1Audit() {
    console.log('================================================================');
    console.log('🔍 BYTEBEACON CRITICAL REGRESSION AUDIT - PHASE 1 PROBE');
    console.log('================================================================\n');

    const results = {};

    // 1. DATAHOUSE DIRECT API CHECKS
    console.log('--- 1. Testing DataHouse Direct API Connection ---');
    try {
        const profile = await getAgentProfile();
        console.log('DataHouse Profile:', profile.ok ? `OK (Agent: ${profile.agent?.businessName || profile.agent?.name || 'Active'}, Status: ${profile.agent?.status})` : `FAILED (${JSON.stringify(profile.error)})`);
        results.datahouse_profile = profile;
    } catch (e) {
        console.error('DataHouse Profile Error:', e.message);
        results.datahouse_profile = { ok: false, error: e.message };
    }

    try {
        const wallet = await getWalletBalance();
        console.log('DataHouse Wallet:', wallet.ok ? `OK (Balance: GH₵ ${wallet.balance}, Currency: ${wallet.currency})` : `FAILED (${JSON.stringify(wallet.error)})`);
        results.datahouse_wallet = wallet;
    } catch (e) {
        console.error('DataHouse Wallet Error:', e.message);
        results.datahouse_wallet = { ok: false, error: e.message };
    }

    try {
        const bundles = await getBundles({ limit: 5 });
        console.log('DataHouse Bundles:', bundles.ok ? `OK (Count: ${bundles.bundles?.length})` : `FAILED (${JSON.stringify(bundles.error)})`);
        results.datahouse_bundles = bundles;
    } catch (e) {
        console.error('DataHouse Bundles Error:', e.message);
        results.datahouse_bundles = { ok: false, error: e.message };
    }

    try {
        const beneficiaries = await getBeneficiaries({ network: 'MTN', status: 'pending', limit: 5 });
        console.log('DataHouse Beneficiaries:', beneficiaries.ok ? `OK (Count: ${beneficiaries.beneficiaries?.length || beneficiaries.items?.length || 0})` : `FAILED (${JSON.stringify(beneficiaries.error)})`);
        results.datahouse_beneficiaries = beneficiaries;
    } catch (e) {
        console.error('DataHouse Beneficiaries Error:', e.message);
        results.datahouse_beneficiaries = { ok: false, error: e.message };
    }

    try {
        const orders = await getOrders({ limit: 5 });
        console.log('DataHouse Orders:', orders.ok ? `OK (Count: ${orders.orders?.length || orders.items?.length || 0})` : `FAILED (${JSON.stringify(orders.error)})`);
        results.datahouse_orders = orders;
    } catch (e) {
        console.error('DataHouse Orders Error:', e.message);
        results.datahouse_orders = { ok: false, error: e.message };
    }

    // 2. DATABASE SCHEMA & TABLE HEALTH
    console.log('\n--- 2. Database Queries & Relations Check ---');
    
    // Check users
    try {
        const [users] = await pool.execute('SELECT COUNT(*)::integer as count FROM users');
        console.log('Users Table count:', users[0].count);
    } catch (e) {
        console.error('❌ Users Table Error:', e.message);
    }

    // Check transactions
    try {
        const [txCount] = await pool.execute('SELECT COUNT(*)::integer as count FROM transactions');
        console.log('Transactions Table count:', txCount[0].count);
    } catch (e) {
        console.error('❌ Transactions Table Error:', e.message);
    }

    // Check data_bundles
    try {
        const [dbCount] = await pool.execute('SELECT COUNT(*)::integer as count FROM data_bundles');
        console.log('Data Bundles Table count:', dbCount[0].count);
    } catch (e) {
        console.error('❌ Data Bundles Table Error:', e.message);
    }

    // Check mtn_beneficiary_approvals
    try {
        const [mtnCount] = await pool.execute('SELECT COUNT(*)::integer as count FROM mtn_beneficiary_approvals');
        console.log('MTN Approvals Table count:', mtnCount[0].count);
    } catch (e) {
        console.error('❌ MTN Approvals Table Error:', e.message);
    }

    // Check activity_logs
    try {
        const [actCount] = await pool.execute('SELECT COUNT(*)::integer as count FROM activity_logs');
        console.log('Activity Logs Table count:', actCount[0].count);
    } catch (e) {
        console.error('❌ Activity Logs Table Error:', e.message);
    }

    // Check agent_pricing
    try {
        const [apCount] = await pool.execute('SELECT COUNT(*)::integer as count FROM agent_pricing');
        console.log('Agent Pricing Table count:', apCount[0].count);
    } catch (e) {
        console.error('❌ Agent Pricing Table Error:', e.message);
    }

    // Check agent_stores
    try {
        const [asCount] = await pool.execute('SELECT COUNT(*)::integer as count FROM agent_stores');
        console.log('Agent Stores Table count:', asCount[0].count);
    } catch (e) {
        console.error('❌ Agent Stores Table Error:', e.message);
    }

    // 3. TEST SPECIFIC QUERY JOINS THAT COULD FAIL
    console.log('\n--- 3. Testing Complex Query Joins ---');
    
    // User transactions query
    try {
        const [userTx] = await pool.execute(`
            SELECT t.*, d.network as bundle_network, d.data_amount as bundle_amount
            FROM transactions t
            LEFT JOIN data_bundles d ON t.bundle_id = d.id::uuid
            ORDER BY t.created_at DESC
            LIMIT 5
        `);
        console.log('✅ User transactions join query succeeded. Sample count:', userTx.length);
    } catch (e) {
        console.error('❌ User transactions join query FAILED:', e.message);
    }

    // Admin transactions query
    try {
        const [adminTx] = await pool.execute(`
            SELECT t.id, t.recipient_phone, t.amount_ghc, t.status, t.created_at, t.updated_at,
                   t.retry_count, t.failure_reason, t.paystack_reference,
                   COALESCE(p.full_name, p.email, u.email, 'Direct Customer') as "userName",
                   COALESCE(p.email, u.email, 'unknown@customer.com') as "userEmail",
                   COALESCE(p.phone, 'N/A') as "userPhone",
                   d.network, d.data_amount as "dataAmount",
                   d.price_ghc as "bundlePriceGhc", d.agent_price_ghc as "bundleAgentPriceGhc"
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.uuid
            LEFT JOIN profiles p ON t.user_id = p.id
            LEFT JOIN data_bundles d ON t.bundle_id::text = d.id::text
            ORDER BY t.created_at DESC
            LIMIT 5
        `);
        console.log('✅ Admin transactions join query succeeded. Sample count:', adminTx.length);
    } catch (e) {
        console.error('❌ Admin transactions join query FAILED:', e.message);
    }

    // Activity logs query
    try {
        const [actLogs] = await pool.execute(`
            SELECT al.*, 
                   COALESCE(p.full_name, p.email, u.email, 'System') as user_name, 
                   u.email as user_email,
                   ur.role as user_role
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.uuid
            LEFT JOIN profiles p ON al.user_id = p.id
            LEFT JOIN user_roles ur ON al.user_id = ur.user_id
            ORDER BY al.created_at DESC
            LIMIT 5
        `);
        console.log('✅ Activity logs join query succeeded. Sample count:', actLogs.length);
    } catch (e) {
        console.error('❌ Activity logs join query FAILED:', e.message);
    }

    console.log('\n================================================================');
    console.log('PHASE 1 AUDIT PROBE COMPLETED');
    console.log('================================================================');
    process.exit(0);
}

runPhase1Audit().catch(err => {
    console.error('Fatal probe error:', err);
    process.exit(1);
});
