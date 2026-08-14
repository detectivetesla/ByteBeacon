const assert = require('assert');
const pool = require('../config/database');
const { initializeTables } = require('../utils/dbInit');
const { getPendingCount, markSeen, getMtnApprovals } = require('../controllers/adminMtnApproval.controller');
const { getMyPendingCount, markMySeen, getMyMtnApprovals } = require('../controllers/userMtnApproval.controller');
const { getAllUsers, getAllTransactions, getActivityLogs } = require('../controllers/admin.controller');

function createMockRes() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        setHeader(key, val) {
            this.headers[key] = val;
        },
        json(data) {
            this.body = data;
            return this;
        }
    };
}

async function runMtnBadgeAndPaginationTests() {
    console.log('🧪 Starting MTN Pending Badge & Admin Server-Side Pagination Test Suite...\n');

    // Run table initializations / migrations first
    try {
        await initializeTables();
        console.log('✅ Database schema and migrations initialized successfully.\n');
    } catch (e) {
        console.warn('⚠️ Note during initializeTables:', e.message);
    }

    let passed = 0;
    let failed = 0;

    // Fetch a real user ID from the database for context
    let testAdminId;
    let testUserId;

    try {
        const [adminRows] = await pool.execute(
            "SELECT u.uuid FROM users u JOIN user_roles ur ON u.uuid = ur.user_id WHERE ur.role = 'admin' LIMIT 1"
        );
        if (adminRows.length > 0) {
            testAdminId = adminRows[0].uuid;
        }

        const [userRows] = await pool.execute("SELECT uuid FROM users LIMIT 1");
        if (userRows.length > 0) {
            testUserId = userRows[0].uuid;
        }
    } catch (e) {
        console.warn('Database lookup warning:', e.message);
    }

    if (!testAdminId && testUserId) testAdminId = testUserId;

    // 1. Test Admin getPendingCount returns count, totalPending, and unreadCount
    try {
        const req = { user: { id: testAdminId, role: 'admin' } };
        const res = createMockRes();

        await getPendingCount(req, res);

        assert.strictEqual(res.statusCode, 200, 'getPendingCount must return 200 OK');
        assert.strictEqual(res.body.success, true, 'getPendingCount must return success: true');
        assert(typeof res.body.count === 'number', 'res.body.count must be a number');
        assert(typeof res.body.totalPending === 'number', 'res.body.totalPending must be a number');
        assert(typeof res.body.unreadCount === 'number', 'res.body.unreadCount must be a number');
        assert.strictEqual(res.body.count, res.body.unreadCount, 'count must match unreadCount');

        console.log(`  ✅ [PASS 1/7] Admin getPendingCount returned totalPending=${res.body.totalPending}, unreadCount=${res.body.unreadCount}`);
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 1/7] Admin getPendingCount test failed:', err.message);
        failed++;
    }

    // 2. Test Admin markSeen resets unreadCount to 0
    try {
        const markReq = { user: { id: testAdminId, role: 'admin' } };
        const markRes = createMockRes();

        await markSeen(markReq, markRes);

        assert.strictEqual(markRes.statusCode, 200, 'markSeen must return 200 OK');
        assert.strictEqual(markRes.body.success, true, 'markSeen must return success: true');

        // Immediately verify count is 0
        const countReq = { user: { id: testAdminId, role: 'admin' } };
        const countRes = createMockRes();
        await getPendingCount(countReq, countRes);

        assert.strictEqual(countRes.body.unreadCount, 0, 'unreadCount must be 0 after markSeen');
        assert.strictEqual(countRes.body.count, 0, 'count must be 0 after markSeen');

        console.log(`  ✅ [PASS 2/7] Admin markSeen successfully reset badge unreadCount to 0 (Total pending preserved: ${countRes.body.totalPending})`);
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 2/7] Admin markSeen test failed:', err.message);
        failed++;
    }

    // 3. Test User getMyPendingCount & markMySeen
    try {
        const markReq = { user: { id: testUserId, role: 'customer' } };
        const markRes = createMockRes();

        await markMySeen(markReq, markRes);

        assert.strictEqual(markRes.statusCode, 200, 'markMySeen must return 200 OK');
        assert.strictEqual(markRes.body.success, true);

        const countReq = { user: { id: testUserId, role: 'customer' } };
        const countRes = createMockRes();
        await getMyPendingCount(countReq, countRes);

        assert.strictEqual(countRes.body.count, 0, 'user unreadCount must be 0 after markMySeen');

        console.log(`  ✅ [PASS 3/7] User getMyPendingCount & markMySeen verified cleanly`);
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 3/7] User pending count test failed:', err.message);
        failed++;
    }

    // 4. Test getMtnApprovals server-side pagination with metadata
    try {
        const req = { query: { page: '1', limit: '10' }, user: { id: testAdminId, role: 'admin' } };
        const res = createMockRes();

        await getMtnApprovals(req, res);

        assert.strictEqual(res.statusCode, 200, 'getMtnApprovals must return 200 OK');
        assert.strictEqual(res.body.success, true);
        assert(Array.isArray(res.body.data), 'getMtnApprovals data must be an array');
        assert(res.body.meta, 'getMtnApprovals must return meta object');
        assert.strictEqual(res.body.meta.page, 1);
        assert.strictEqual(res.body.meta.limit, 10);
        assert(typeof res.body.meta.total === 'number');
        assert(typeof res.body.meta.totalPages === 'number');
        assert(typeof res.body.meta.hasNextPage === 'boolean');
        assert(typeof res.body.meta.hasPreviousPage === 'boolean');

        console.log(`  ✅ [PASS 4/7] getMtnApprovals pagination returned ${res.body.data.length} records, total=${res.body.meta.total}, pages=${res.body.meta.totalPages}`);
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 4/7] getMtnApprovals pagination test failed:', err.message);
        failed++;
    }

    // 5. Test getAllUsers server-side pagination with metadata
    try {
        const req = { query: { page: '1', limit: '5' }, user: { id: testAdminId, role: 'admin' } };
        const res = createMockRes();

        await getAllUsers(req, res);

        assert.strictEqual(res.statusCode, 200, 'getAllUsers must return 200 OK');
        assert(res.body.data, 'getAllUsers must return data envelope');
        assert(Array.isArray(res.body.data), 'getAllUsers data must be an array');
        assert(res.body.pagination, 'getAllUsers must return pagination envelope');
        assert.strictEqual(res.body.pagination.page, 1);
        assert.strictEqual(res.body.pagination.limit, 5);
        assert(typeof res.body.pagination.total === 'number');

        console.log(`  ✅ [PASS 5/7] getAllUsers pagination returned ${res.body.data.length} users, total=${res.body.pagination.total}`);
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 5/7] getAllUsers pagination test failed:', err.message);
        failed++;
    }

    // 6. Test getAllTransactions server-side pagination with metadata
    try {
        const req = { query: { page: '1', limit: '5' }, user: { id: testAdminId, role: 'admin' } };
        const res = createMockRes();

        await getAllTransactions(req, res);

        assert.strictEqual(res.statusCode, 200, 'getAllTransactions must return 200 OK');
        assert(res.body.data, 'getAllTransactions must return data envelope');
        assert(Array.isArray(res.body.data), 'getAllTransactions data must be an array');
        assert(res.body.pagination, 'getAllTransactions must return pagination envelope');
        assert.strictEqual(res.body.pagination.page, 1);
        assert.strictEqual(res.body.pagination.limit, 5);

        console.log(`  ✅ [PASS 6/7] getAllTransactions pagination returned ${res.body.data.length} transactions, total=${res.body.pagination.total}`);
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 6/7] getAllTransactions pagination test failed:', err.message);
        failed++;
    }

    // 7. Test getActivityLogs server-side pagination with metadata
    try {
        const req = { query: { page: '1', limit: '5' }, user: { id: testAdminId, role: 'admin' } };
        const res = createMockRes();

        await getActivityLogs(req, res);

        assert.strictEqual(res.statusCode, 200, 'getActivityLogs must return 200 OK');
        assert(res.body.data, 'getActivityLogs must return data envelope');
        assert(Array.isArray(res.body.data), 'getActivityLogs data must be an array');
        assert(res.body.pagination, 'getActivityLogs must return pagination envelope');
        assert.strictEqual(res.body.pagination.page, 1);
        assert.strictEqual(res.body.pagination.limit, 5);

        console.log(`  ✅ [PASS 7/7] getActivityLogs pagination returned ${res.body.data.length} logs, total=${res.body.pagination.total}`);
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 7/7] getActivityLogs pagination test failed:', err.message);
        failed++;
    }

    console.log(`\n======================================================`);
    console.log(`MTN Badge & Admin Pagination Diagnostics: ${passed} Passed, ${failed} Failed`);
    console.log(`======================================================\n`);

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runMtnBadgeAndPaginationTests().catch(err => {
    console.error('Test execution fatal error:', err);
    process.exit(1);
});
