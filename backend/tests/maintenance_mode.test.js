const assert = require('assert');
const maintenanceMiddleware = require('../middleware/maintenance.middleware');
const { getCachedMaintenanceState, invalidateMaintenanceCache } = maintenanceMiddleware;

async function runMaintenanceTests() {
    console.log('🧪 Starting Maintenance Mode Verification Test Suite...\n');

    let passed = 0;
    let failed = 0;

    const mockPool = require('../config/database');

    // 1. In-memory cache & fast retrieval
    try {
        invalidateMaintenanceCache();
        const state = await getCachedMaintenanceState();
        assert(typeof state.enabled === 'boolean', 'Cache state.enabled must be boolean');
        console.log('  ✅ [PASS 1/8] 1. In-memory maintenance cache initialized');
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 1/8] 1. Cache initialization failed:', err.message);
        failed++;
    }

    // Mock response helper
    function createMockRes() {
        const res = {
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
        return res;
    }

    // 2. Public Bundles Catalog Bypasses Maintenance
    try {
        const req = { path: '/api/bundles', method: 'GET', headers: {} };
        const res = createMockRes();
        let nextCalled = false;

        await maintenanceMiddleware(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true, 'Public bundles catalog must bypass maintenance check');
        console.log('  ✅ [PASS 2/8] 2. Public data bundle catalog (/api/bundles) is always accessible');
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 2/8] 2. Bundle catalog bypass failed:', err.message);
        failed++;
    }

    // 3. Webhooks Endpoint Bypasses Maintenance
    try {
        const req = { path: '/api/webhooks/datahouse', method: 'POST', headers: {} };
        const res = createMockRes();
        let nextCalled = false;

        await maintenanceMiddleware(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true, 'Provider webhooks must never be blocked by maintenance');
        console.log('  ✅ [PASS 3/8] 3. DataHouse webhooks (/api/webhooks/*) bypass maintenance');
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 3/8] 3. Webhook bypass failed:', err.message);
        failed++;
    }

    // 4. Public Auth Endpoints Bypass Maintenance
    try {
        const req = { path: '/api/auth/login', method: 'POST', headers: {} };
        const res = createMockRes();
        let nextCalled = false;

        await maintenanceMiddleware(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true, 'Auth login endpoint must be reachable to submit credentials');
        console.log('  ✅ [PASS 4/8] 4. Authentication entrypoints (/api/auth/*) remain reachable');
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 4/8] 4. Auth bypass failed:', err.message);
        failed++;
    }

    // 5. Admin Request Bypasses Maintenance
    try {
        const req = { path: '/api/transactions/all', method: 'GET', user: { id: 'admin-1', role: 'admin' }, headers: {} };
        const res = createMockRes();
        let nextCalled = false;

        await maintenanceMiddleware(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true, 'Admin users must bypass maintenance on any route');
        console.log('  ✅ [PASS 5/8] 5. Verified Administrator requests bypass maintenance mode');
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 5/8] 5. Admin bypass failed:', err.message);
        failed++;
    }

    // 6. Admin API Route Prefix Bypasses Maintenance
    try {
        const req = { path: '/api/admin/maintenance', method: 'PUT', headers: {} };
        const res = createMockRes();
        let nextCalled = false;

        await maintenanceMiddleware(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true, '/api/admin/* paths must be accessible');
        console.log('  ✅ [PASS 6/8] 6. Admin portal routes (/api/admin/*) bypass maintenance');
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 6/8] 6. Admin route bypass failed:', err.message);
        failed++;
    }

    // 7. Protected Transaction Operation returns 503 when maintenance is simulated ON
    try {
        // Temporarily activate maintenance state
        const originalExecute = mockPool.execute;
        mockPool.execute = async (sql) => {
            if (sql.includes('maintenance_mode')) {
                return [[{ setting_value: JSON.stringify({ enabled: true, title: "Upgrading", message: "Upgrading systems", estimatedEnd: "03:00 AM" }) }]];
            }
            return [[]];
        };
        invalidateMaintenanceCache();

        const req = { path: '/api/transactions/purchase', method: 'POST', user: { id: 'user-1', role: 'customer' }, headers: {} };
        const res = createMockRes();
        let nextCalled = false;

        await maintenanceMiddleware(req, res, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, false, 'Non-admin transaction purchase must be blocked');
        assert.strictEqual(res.statusCode, 503, 'Must return HTTP 503 Service Unavailable');
        assert.strictEqual(res.headers['Retry-After'], '3600', 'Must send Retry-After header');
        assert.strictEqual(res.body.error.code, 'MAINTENANCE_MODE', 'Error code must be MAINTENANCE_MODE');
        assert.strictEqual(res.body.error.retryable, true, 'Error must indicate retryable');
        assert(res.body.error.details.estimatedReturn, 'Must provide estimated return detail');

        console.log('  ✅ [PASS 7/8] 7. Protected transaction returns HTTP 503 Service Unavailable with Retry-After');
        passed++;

        // Restore mockPool
        mockPool.execute = originalExecute;
        invalidateMaintenanceCache();
    } catch (err) {
        console.error('  ❌ [FAIL 7/8] 7. Protected route maintenance check failed:', err.message);
        failed++;
    }

    // 8. Public Health & Maintenance Endpoints
    try {
        const req = { path: '/api/system/maintenance', method: 'GET', headers: {} };
        const res = createMockRes();
        let nextCalled = false;

        await maintenanceMiddleware(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true, 'GET /api/system/maintenance must always pass');
        console.log('  ✅ [PASS 8/8] 8. Public maintenance status endpoint is always reachable');
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 8/8] 8. Maintenance check route failed:', err.message);
        failed++;
    }

    console.log('\n========================================================');
    console.log(`📊 Maintenance Mode Test Results: ${passed}/${passed + failed} Passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
    console.log('========================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runMaintenanceTests().catch(err => {
    console.error('Unexpected error running maintenance tests:', err);
    process.exit(1);
});
