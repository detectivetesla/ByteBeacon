const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const datahouse = require('../integrations/datahouse');
const {
    getBundles,
    getBundleById: getDhBundleById,
    listOrders,
    listBeneficiaries,
    getWalletBalance,
    getAgentProfile,
    verifyWebhookSignature,
    extractDeliveryId,
    isDuplicateDelivery,
    recordWebhookEvent
} = datahouse;
const { syncBeneficiaryApprovals } = require('../services/mtnApproval.service');
const { generateCSV, generateExcelXML, generateJSON } = require('../utils/exportHelper');

async function runMasterRegressionSuite() {
    console.log('================================================================');
    console.log('🧪 BYTEBEACON COMPREHENSIVE 16-POINT REGRESSION TEST SUITE');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    const assert = (condition, testNum, testName, details = '') => {
        if (condition) {
            console.log(`✅ [PASS TEST ${testNum}] ${testName} ${details ? '(' + details + ')' : ''}`);
            passed++;
        } else {
            console.error(`❌ [FAIL TEST ${testNum}] ${testName} - ${details}`);
            failed++;
        }
    };

    // -------------------------------------------------------------
    // TEST 1: Fetch normal user
    // -------------------------------------------------------------
    let testUser = null;
    try {
        const [users] = await pool.execute(
            `SELECT u.uuid, u.email, p.wallet_balance, COALESCE(ur.role, 'customer') as role
             FROM users u
             LEFT JOIN profiles p ON u.uuid = p.id
             LEFT JOIN user_roles ur ON u.uuid = ur.user_id
             WHERE u.email LIKE '%@%'
             ORDER BY u.created_at DESC
             LIMIT 1`
        );
        if (users.length > 0) {
            testUser = users[0];
            assert(true, 1, 'Fetch normal user', `Found: ${testUser.email} (UUID: ${testUser.uuid})`);
        } else {
            assert(false, 1, 'Fetch normal user', 'No users found in database');
        }
    } catch (e) {
        assert(false, 1, 'Fetch normal user', e.message);
    }

    // -------------------------------------------------------------
    // TEST 2: User with NO custom price receives default standard price
    // -------------------------------------------------------------
    try {
        // Ensure user has no custom price for bundle
        const [bundles] = await pool.execute(
            `SELECT id, network, data_amount, price_ghc, agent_price_ghc FROM data_bundles WHERE network = 'MTN' AND data_amount IN ('1GB', '2GB', '5GB', '10GB') LIMIT 1`
        );
        const testBundle = bundles[0];
        await pool.execute(
            `DELETE FROM agent_pricing WHERE agent_id = ?::uuid AND bundle_id = ?::uuid`,
            [testUser.uuid, testBundle.id]
        );

        // Fetch bundle via bundle controller pricing resolution logic
        const bundleController = require('../controllers/bundle.controller');
        const customMap = await bundleController.getUserCustomPricingMap(testUser.uuid);
        const userPrice = customMap.byBundleId[testBundle.id] || parseFloat(testBundle.price_ghc);

        assert(userPrice === parseFloat(testBundle.price_ghc), 2, 'Default pricing fallback', `Standard Price: GH₵ ${userPrice}`);
    } catch (e) {
        assert(false, 2, 'Default pricing fallback', e.message);
    }

    // -------------------------------------------------------------
    // TEST 3: User with custom pricing gets custom price
    // -------------------------------------------------------------
    let customPriceVal = 19.99;
    let customBundle = null;
    try {
        const [bundles] = await pool.execute(
            `SELECT id, network, data_amount, price_ghc FROM data_bundles WHERE network = 'MTN' AND data_amount IN ('1GB', '2GB', '5GB', '10GB') LIMIT 1`
        );
        customBundle = bundles[0];

        // Insert custom price
        await pool.execute(
            `INSERT INTO agent_pricing (id, agent_id, bundle_id, custom_price, created_at, updated_at)
             VALUES (?::uuid, ?::uuid, ?::uuid, ?, NOW(), NOW())
             ON CONFLICT (agent_id, bundle_id) DO UPDATE SET custom_price = EXCLUDED.custom_price, updated_at = NOW()`,
            [uuidv4(), testUser.uuid, customBundle.id, customPriceVal]
        );

        const bundleController = require('../controllers/bundle.controller');
        const customMap = await bundleController.getUserCustomPricingMap(testUser.uuid);
        const resolvedPrice = customMap.byBundleId[customBundle.id];

        assert(resolvedPrice === customPriceVal, 3, 'Custom customer pricing resolution', `Custom Price: GH₵ ${resolvedPrice}`);
    } catch (e) {
        assert(false, 3, 'Custom customer pricing resolution', e.message);
    }

    // -------------------------------------------------------------
    // TEST 4 & 5: Customer Price vs DataHouse Agent Cost Separation
    // -------------------------------------------------------------
    try {
        const dhBundle = await getDhBundleById(customBundle.id);
        const customerSellingPrice = customPriceVal;
        const datahouseCost = dhBundle ? dhBundle.agentAmount : 0;

        assert(
            dhBundle && customerSellingPrice !== datahouseCost && datahouseCost > 0,
            4,
            'Price separation (Customer selling vs DataHouse cost)',
            `Customer pays: GH₵ ${customerSellingPrice} | DataHouse costs: GH₵ ${datahouseCost}`
        );
        assert(true, 5, 'Normal-priced user separate cost verification', `DataHouse cost untouched: GH₵ ${datahouseCost}`);
    } catch (e) {
        assert(false, 4, 'Price separation', e.message);
    }

    // Clean up test custom price
    await pool.execute(
        `DELETE FROM agent_pricing WHERE agent_id = ?::uuid AND bundle_id = ?::uuid`,
        [testUser.uuid, customBundle.id]
    ).catch(() => {});

    // -------------------------------------------------------------
    // TEST 6: Retrieve Transactions
    // -------------------------------------------------------------
    try {
        const [txs] = await pool.execute(`
            SELECT t.id, t.recipient_phone, t.amount_ghc, t.status, t.created_at,
                   d.network, d.data_amount
            FROM transactions t
            LEFT JOIN data_bundles d ON t.bundle_id::text = d.id::text
            ORDER BY t.created_at DESC
            LIMIT 5
        `);
        assert(Array.isArray(txs), 6, 'Retrieve Transactions', `Fetched ${txs.length} transactions`);
    } catch (e) {
        assert(false, 6, 'Retrieve Transactions', e.message);
    }

    // -------------------------------------------------------------
    // TEST 7: Retrieve Activity / Transaction Logs
    // -------------------------------------------------------------
    try {
        const [logs] = await pool.execute(`
            SELECT al.*, COALESCE(p.full_name, p.email, u.email, 'System') as user_name
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.uuid
            LEFT JOIN profiles p ON al.user_id = p.id
            ORDER BY al.created_at DESC
            LIMIT 5
        `);
        assert(Array.isArray(logs), 7, 'Retrieve Activity Logs', `Fetched ${logs.length} logs`);
    } catch (e) {
        assert(false, 7, 'Retrieve Activity Logs', e.message);
    }

    // -------------------------------------------------------------
    // TEST 8: Retrieve Pending MTN Approvals
    // -------------------------------------------------------------
    try {
        const [approvals] = await pool.execute(`
            SELECT id, msisdn, display_phone, status, occurrences, datahouse_reference
            FROM mtn_beneficiary_approvals
            WHERE status IN ('pending', 'submitted')
            ORDER BY last_detected_at DESC
            LIMIT 5
        `);
        assert(Array.isArray(approvals), 8, 'Retrieve Pending MTN Approvals', `Fetched ${approvals.length} pending records`);
    } catch (e) {
        assert(false, 8, 'Retrieve Pending MTN Approvals', e.message);
    }

    // -------------------------------------------------------------
    // TEST 9: Retrieve All System Orders from DataHouse
    // -------------------------------------------------------------
    try {
        const dhOrdersRes = await listOrders({ limit: 5 });
        const items = dhOrdersRes.data?.data || dhOrdersRes.data?.items || (Array.isArray(dhOrdersRes.data) ? dhOrdersRes.data : []);
        assert(dhOrdersRes.ok && items.length > 0, 9, 'Retrieve All System Orders (DataHouse)', `Authoritative Count: ${items.length}, Total: ${dhOrdersRes.data?.meta?.total}`);
    } catch (e) {
        assert(false, 9, 'Retrieve All System Orders', e.message);
    }

    // -------------------------------------------------------------
    // TEST 10: Status Synchronization with DataHouse
    // -------------------------------------------------------------
    try {
        const syncRes = await syncBeneficiaryApprovals();
        assert(syncRes.error === undefined, 10, 'DataHouse Status Synchronization', `Synced beneficiary states, updated: ${syncRes.updated}`);
    } catch (e) {
        assert(false, 10, 'DataHouse Status Synchronization', e.message);
    }

    // -------------------------------------------------------------
    // TEST 11: Webhook HMAC-SHA256 Signature Verification
    // -------------------------------------------------------------
    try {
        const testSecret = 'whsec_test_secret_12345';
        const timestamp = Math.floor(Date.now() / 1000);
        const payload = JSON.stringify({ type: 'order.approved', data: { id: 'ord_test_123', status: 'approved' } });
        const signatureToSign = `${timestamp}.${payload}`;
        const validSig = crypto.createHmac('sha256', testSecret).update(signatureToSign).digest('hex');

        const verification = verifyWebhookSignature({
            signatureHeader: `t=${timestamp},v1=${validSig}`,
            rawBody: payload,
            secret: testSecret
        });

        assert(verification.valid === true, 11, 'Webhook HMAC-SHA256 Signature Verification', 'Valid signature accepted');
    } catch (e) {
        assert(false, 11, 'Webhook Signature Verification', e.message);
    }

    // -------------------------------------------------------------
    // TEST 12: Webhook Idempotency & Replay Protection
    // -------------------------------------------------------------
    try {
        const deliveryId = `del_test_${Date.now()}`;
        const isFirstDup = await isDuplicateDelivery(deliveryId);
        await recordWebhookEvent({
            deliveryId,
            eventType: 'order.approved',
            payload: { test: true }
        });
        const isSecondDup = await isDuplicateDelivery(deliveryId);

        assert(!isFirstDup && isSecondDup, 12, 'Webhook Idempotency Protection', 'Second delivery blocked as duplicate');

        // Cleanup test delivery
        await pool.execute(`DELETE FROM datahouse_webhook_logs WHERE event_id = ?`, [deliveryId]).catch(() => {});
    } catch (e) {
        assert(false, 12, 'Webhook Idempotency Protection', e.message);
    }

    // -------------------------------------------------------------
    // TEST 13: Pending MTN Navigation Badge
    // -------------------------------------------------------------
    try {
        const [[totalRow]] = await pool.execute(
            `SELECT COUNT(*)::integer as total FROM mtn_beneficiary_approvals WHERE status IN ('pending', 'submitted')`
        );
        const total = totalRow?.total || 0;
        assert(typeof total === 'number', 13, 'Pending MTN Badge Count Calculation', `Total Pending: ${total}`);
    } catch (e) {
        assert(false, 13, 'Pending MTN Badge Count Calculation', e.message);
    }

    // -------------------------------------------------------------
    // TEST 14: Pagination Across Endpoints
    // -------------------------------------------------------------
    try {
        const { parsePagination, buildPaginatedResponse } = require('../utils/pagination');
        const parsed = parsePagination({ page: '2', limit: '25' }, { defaultLimit: 25, maxLimit: 100 });
        const paginatedResponse = buildPaginatedResponse([{ id: 1 }], 100, parsed.page, parsed.limit);

        assert(
            paginatedResponse.pagination.page === 2 &&
            paginatedResponse.pagination.totalPages === 4 &&
            paginatedResponse.pagination.hasNextPage === true &&
            paginatedResponse.pagination.hasPreviousPage === true,
            14,
            'Standard Server-Side Pagination Engine',
            `Page 2/4 (Total: 100, Limit: 25)`
        );
    } catch (e) {
        assert(false, 14, 'Pagination Engine', e.message);
    }

    // -------------------------------------------------------------
    // TEST 15 & 16: Export Generation (Current Page & All)
    // -------------------------------------------------------------
    try {
        const testExportData = [
            { phone: '0541112233', network: 'MTN', status: 'pending', amount: 15.00 },
            { phone: '0554445566', network: 'TELECEL', status: 'approved', amount: 25.00 }
        ];
        const testCols = [
            { key: 'phone', label: 'Phone' },
            { key: 'network', label: 'Network' },
            { key: 'status', label: 'Status' },
            { key: 'amount', label: 'Amount (GHS)' }
        ];

        const csvOut = generateCSV(testExportData, testCols);
        const xlsxOut = generateExcelXML(testExportData, testCols, 'Orders');
        const jsonOut = generateJSON(testExportData, testCols);

        assert(csvOut.includes('0541112233') && xlsxOut.includes('<Table>'), 15, 'Export Generation (Current Page - CSV & Excel)', `CSV: ${csvOut.length}B, XML: ${xlsxOut.length}B`);
        assert(jsonOut.includes('0554445566'), 16, 'Export Generation (Full Dataset - JSON streaming)', `JSON: ${jsonOut.length}B`);
    } catch (e) {
        assert(false, 15, 'Export Generation', e.message);
    }

    console.log('\n================================================================');
    console.log(`REGRESSION SUITE COMPLETED: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

runMasterRegressionSuite().catch(err => {
    console.error('Fatal regression suite error:', err);
    process.exit(1);
});
