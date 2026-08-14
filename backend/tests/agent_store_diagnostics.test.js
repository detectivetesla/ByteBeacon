const assert = require('assert');
const pool = require('../config/database');
const { getAllAgentStores, getAllAgentWithdrawals, getAllUsers } = require('../controllers/admin.controller');

async function runAgentStoreDiagnostics() {
    console.log('🧪 Starting Agent Store & Agent Details End-to-End Diagnostics Suite...\n');

    let passed = 0;
    let failed = 0;

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

    // 1. Test Admin Get All Agent Stores
    try {
        const req = { query: {}, user: { id: 'admin-1', role: 'admin' } };
        const res = createMockRes();

        await getAllAgentStores(req, res);

        assert.strictEqual(res.statusCode, 200, 'getAllAgentStores must return 200 OK');
        assert(Array.isArray(res.body), 'getAllAgentStores must return an array');
        console.log(`  ✅ [PASS 1/6] 1. GET /api/admin/agent-stores executed successfully (${res.body.length} stores retrieved)`);
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 1/6] 1. getAllAgentStores failed:', err.message);
        failed++;
    }

    // 2. Test Admin Get All Agent Withdrawals
    try {
        const req = { query: {}, user: { id: 'admin-1', role: 'admin' } };
        const res = createMockRes();

        await getAllAgentWithdrawals(req, res);

        assert.strictEqual(res.statusCode, 200, 'getAllAgentWithdrawals must return 200 OK');
        assert(Array.isArray(res.body), 'getAllAgentWithdrawals must return an array');
        console.log(`  ✅ [PASS 2/6] 2. GET /api/admin/agent-stores/withdrawals executed successfully (${res.body.length} withdrawals retrieved)`);
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 2/6] 2. getAllAgentWithdrawals failed:', err.message);
        failed++;
    }

    // 3. Test Admin Get Users with role=agent
    try {
        const req = { query: { role: 'agent' }, user: { id: 'admin-1', role: 'admin' } };
        const res = createMockRes();

        await getAllUsers(req, res);

        assert.strictEqual(res.statusCode, 200, 'getAllUsers (agent) must return 200 OK');
        assert(res.body && res.body.data && Array.isArray(res.body.data), 'getAllUsers must return standard paginated envelope with data array');
        console.log(`  ✅ [PASS 3/6] 3. GET /api/admin/users?role=agent returned paginated envelope (${res.body.data.length} agents)`);
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 3/6] 3. getAllUsers (agent) failed:', err.message);
        failed++;
    }

    // 4. Test Admin Get Users with role=superagent
    try {
        const req = { query: { role: 'superagent' }, user: { id: 'admin-1', role: 'admin' } };
        const res = createMockRes();

        await getAllUsers(req, res);

        assert.strictEqual(res.statusCode, 200, 'getAllUsers (superagent) must return 200 OK');
        assert(res.body && res.body.data && Array.isArray(res.body.data), 'getAllUsers must return standard paginated envelope with data array');
        console.log(`  ✅ [PASS 4/6] 4. GET /api/admin/users?role=superagent returned paginated envelope (${res.body.data.length} superagents)`);
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 4/6] 4. getAllUsers (superagent) failed:', err.message);
        failed++;
    }

    // 5. Test Admin Get Users with role=admin
    try {
        const req = { query: { role: 'admin' }, user: { id: 'admin-1', role: 'admin' } };
        const res = createMockRes();

        await getAllUsers(req, res);

        assert.strictEqual(res.statusCode, 200, 'getAllUsers (admin) must return 200 OK');
        assert(res.body && res.body.data && Array.isArray(res.body.data), 'getAllUsers must return standard paginated envelope with data array');
        console.log(`  ✅ [PASS 5/6] 5. GET /api/admin/users?role=admin returned paginated envelope (${res.body.data.length} admins)`);
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 5/6] 5. getAllUsers (admin) failed:', err.message);
        failed++;
    }

    // 6. Test Get My Store for User without Store
    try {
        const { getMyStore } = require('../controllers/agentStore.controller');
        const req = { user: { id: '00000000-0000-0000-0000-000000000000' } };
        const res = createMockRes();

        await getMyStore(req, res);

        assert.strictEqual(res.statusCode, 200, 'getMyStore must return 200 OK');
        assert.strictEqual(res.body.hasStore, false, 'Non-existent store must return hasStore: false gracefully');
        console.log('  ✅ [PASS 6/6] 6. GET /api/agent-store/my-store gracefully handles uninitialized store');
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 6/6] 6. getMyStore failed:', err.message);
        failed++;
    }

    console.log('\n========================================================');
    console.log(`📊 Agent Store Diagnostics: ${passed}/${passed + failed} Passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
    console.log('========================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runAgentStoreDiagnostics().catch(err => {
    console.error('Diagnostic error:', err);
    process.exit(1);
});
