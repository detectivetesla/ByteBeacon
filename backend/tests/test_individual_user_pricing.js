const assert = require('assert');
const pool = require('../config/database');
const { getAgentPricing, bulkSetAgentPricing, setAgentPricing, deleteAgentPricing, getAllBundles: adminGetAllBundles } = require('../controllers/admin.controller');
const { getAllBundles, getBundlesByNetwork, getBundleById } = require('../controllers/bundle.controller');

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

async function testUserPricingFlow() {
    console.log('🧪 Starting Comprehensive Individual User Pricing Diagnostics...\n');

    let passed = 0;
    let failed = 0;

    // 1. Get a test user and test bundle
    const [users] = await pool.execute('SELECT uuid, email FROM users LIMIT 1');
    assert(users.length > 0, 'Must have at least 1 user in DB');
    const testUser = users[0];

    const [bundles] = await pool.execute('SELECT id, network, data_amount, price_ghc, agent_price_ghc FROM data_bundles WHERE is_active = true LIMIT 1');
    assert(bundles.length > 0, 'Must have at least 1 bundle in DB');
    const testBundle = bundles[0];

    console.log(`👤 Test User: ${testUser.uuid} (${testUser.email})`);
    console.log(`📦 Test Bundle: ${testBundle.id} - ${testBundle.network} ${testBundle.data_amount} (Standard: GH₵ ${testBundle.price_ghc})`);

    const targetCustomPrice = 7.75;

    // Test 1: bulkSetAgentPricing
    try {
        const setReq = {
            params: { agentId: testUser.uuid },
            body: {
                pricing: [
                    { bundleId: testBundle.id, customPrice: targetCustomPrice }
                ]
            }
        };
        const setRes = createMockRes();
        await bulkSetAgentPricing(setReq, setRes);

        assert.strictEqual(setRes.statusCode, 200);
        assert.strictEqual(setRes.body.message, 'Agent pricing updated successfully');
        console.log('  ✅ [PASS 1/5] Set custom pricing for user successfully');
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 1/5] Failed to set custom pricing:', err.message);
        failed++;
    }

    // Test 2: getAgentPricing
    try {
        const getReq = { params: { agentId: testUser.uuid } };
        const getRes = createMockRes();
        await getAgentPricing(getReq, getRes);

        assert.strictEqual(getRes.statusCode, 200);
        assert(Array.isArray(getRes.body));
        const matchedPricing = getRes.body.find(p => p.bundleId === testBundle.id);
        assert(matchedPricing, 'Must find matched custom pricing in getAgentPricing');
        assert.strictEqual(matchedPricing.customPrice, targetCustomPrice);
        console.log(`  ✅ [PASS 2/5] getAgentPricing verified customPrice=${matchedPricing.customPrice}`);
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 2/5] Failed to fetch agent pricing:', err.message);
        failed++;
    }

    // Test 3: getAllBundles returns custom userPrice for authenticated user
    try {
        const userBundleReq = { user: { id: testUser.uuid, role: 'customer' } };
        const userBundleRes = createMockRes();
        await getAllBundles(userBundleReq, userBundleRes);

        assert.strictEqual(userBundleRes.statusCode, 200);
        assert(Array.isArray(userBundleRes.body));
        const userCatalogBundle = userBundleRes.body.find(b => b.id === testBundle.id || (b.network.toUpperCase() === testBundle.network.toUpperCase() && b.dataAmount === testBundle.data_amount));
        assert(userCatalogBundle, 'Must find bundle in catalog');
        assert.strictEqual(userCatalogBundle.userPrice, targetCustomPrice, `Expected userPrice to be ${targetCustomPrice}, got ${userCatalogBundle.userPrice}`);
        assert.strictEqual(userCatalogBundle.customPrice, targetCustomPrice);

        console.log(`  ✅ [PASS 3/5] getAllBundles correctly resolved userPrice=GH₵ ${userCatalogBundle.userPrice} for customer`);
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 3/5] Failed to resolve userPrice in getAllBundles:', err.message);
        failed++;
    }

    // Test 4: getBundlesByNetwork returns custom userPrice
    try {
        const networkBundleReq = {
            params: { network: testBundle.network.toLowerCase() },
            user: { id: testUser.uuid, role: 'customer' }
        };
        const networkBundleRes = createMockRes();
        await getBundlesByNetwork(networkBundleReq, networkBundleRes);

        assert.strictEqual(networkBundleRes.statusCode, 200);
        const networkCatalogBundle = networkBundleRes.body.find(b => b.id === testBundle.id || (b.network.toUpperCase() === testBundle.network.toUpperCase() && b.dataAmount === testBundle.data_amount));
        assert(networkCatalogBundle, 'Must find bundle by network');
        assert.strictEqual(networkCatalogBundle.userPrice, targetCustomPrice);

        console.log(`  ✅ [PASS 4/5] getBundlesByNetwork correctly resolved userPrice=GH₵ ${networkCatalogBundle.userPrice}`);
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 4/5] Failed to resolve userPrice in getBundlesByNetwork:', err.message);
        failed++;
    }

    // Test 5: delete custom pricing reverts to standard price
    try {
        const delReq = { params: { agentId: testUser.uuid, bundleId: testBundle.id } };
        const delRes = createMockRes();
        await deleteAgentPricing(delReq, delRes);

        assert.strictEqual(delRes.statusCode, 200);

        const checkBundleReq = { user: { id: testUser.uuid, role: 'customer' } };
        const checkBundleRes = createMockRes();
        await getAllBundles(checkBundleReq, checkBundleRes);

        const revertedBundle = checkBundleRes.body.find(b => b.id === testBundle.id || (b.network.toUpperCase() === testBundle.network.toUpperCase() && b.dataAmount === testBundle.data_amount));
        assert(revertedBundle, 'Must find bundle');
        assert.strictEqual(revertedBundle.userPrice, parseFloat(testBundle.price_ghc), 'Price must revert to standard price');
        assert.strictEqual(revertedBundle.customPrice, null, 'Custom price must be null after deletion');

        console.log(`  ✅ [PASS 5/5] deleteAgentPricing reverted price back to standard GH₵ ${revertedBundle.userPrice}`);
        passed++;
    } catch (err) {
        console.error('  ❌ [FAIL 5/5] Failed to revert pricing on deletion:', err.message);
        failed++;
    }

    console.log(`\n======================================================`);
    console.log(`Individual User Pricing Diagnostics: ${passed} Passed, ${failed} Failed`);
    console.log(`======================================================\n`);

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

testUserPricingFlow().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
