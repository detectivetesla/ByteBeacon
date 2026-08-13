const assert = require('assert');
const http = require('http');

// Setup local mock server to simulate DataHouse API according to Developer Portal specification
const MOCK_PORT = 9876;
const MOCK_BASE_URL = `http://localhost:${MOCK_PORT}/api/v1`;

let mockServer;
let lastRequest = null;
let orderDatabase = new Map();

function startMockServer() {
    return new Promise((resolve) => {
        mockServer = http.createServer((req, res) => {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
                let parsedBody = null;
                try {
                    parsedBody = bodyStr ? JSON.parse(bodyStr) : null;
                } catch {}

                lastRequest = {
                    method: req.method,
                    url: req.url,
                    headers: req.headers,
                    body: parsedBody
                };

                const url = new URL(req.url, `http://localhost:${MOCK_PORT}`);

                // Verify API key header for all /agent/ routes
                if (url.pathname.startsWith('/api/v1/agent/')) {
                    if (req.headers['x-api-key'] !== 'test_api_key_123') {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: { code: 'UNAUTHORIZED', message: 'Missing or invalid x-api-key' }
                        }));
                        return;
                    }
                }

                // Route: GET /api/v1/agent/me
                if (req.method === 'GET' && url.pathname === '/api/v1/agent/me') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        statusCode: 200,
                        message: 'Success',
                        data: {
                            id: '9b2e5d1a-1234-5678-9abc-def012345678',
                            publicId: 'agt_01J8ABCDEF123456',
                            businessName: 'ByteBeacon Test Agent',
                            businessPhone: '+233241234567',
                            tier: 'standard',
                            status: 'approved',
                            pricePerGb: '4.20'
                        }
                    }));
                    return;
                }

                // Route: GET /api/v1/agent/bundles
                if (req.method === 'GET' && url.pathname === '/api/v1/agent/bundles') {
                    res.writeHead(200, { 'Content-Type': 'application/json', 'x-correlation-id': 'mock-corr-bundles' });
                    res.end(JSON.stringify({
                        success: true,
                        statusCode: 200,
                        message: 'Success',
                        data: {
                            data: [
                                { id: '550e8400-e29b-41d4-a716-446655440000', network: 'MTN', name: 'MTN 1GB', dataVolume: '1GB', bundleType: 'DATA', agentAmount: '4.20', amount: '5.00', isActive: true },
                                { id: '550e8400-e29b-41d4-a716-446655440001', network: 'MTN', name: 'MTN 5GB', dataVolume: '5GB', bundleType: 'DATA', agentAmount: '21.00', amount: '25.00', isActive: true },
                                { id: '550e8400-e29b-41d4-a716-446655440002', network: 'TELECEL', name: 'Telecel 5GB', dataVolume: '5GB', bundleType: 'DATA', agentAmount: '20.00', amount: '22.00', isActive: true }
                            ],
                            meta: { page: 1, limit: 50, total: 3 }
                        }
                    }));
                    return;
                }

                // Route: POST /api/v1/agent/orders
                if (req.method === 'POST' && url.pathname === '/api/v1/agent/orders') {
                    const { bundleId, phoneNumber, idempotencyKey, email } = parsedBody || {};

                    if (phoneNumber === '233240000000') {
                        // Simulate Beneficiary not validated error (HTTP 422)
                        res.writeHead(422, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: { code: 'BENEFICIARY_NOT_VALIDATED', message: 'First-time MTN number not yet validated — recorded for MTN approval' },
                            meta: { correlationId: 'corr-precheck-fail' }
                        }));
                        return;
                    }

                    // Idempotent duplicate check
                    if (orderDatabase.has(idempotencyKey)) {
                        const existing = orderDatabase.get(idempotencyKey);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            statusCode: 200,
                            data: existing,
                            message: 'Duplicate order retrieved'
                        }));
                        return;
                    }

                    const newOrder = {
                        id: `ord_${Date.now()}`,
                        publicId: `ord_01J8${Date.now().toString().slice(-8)}`,
                        referenceCode: `TXN-7GH2K9`,
                        idempotencyKey,
                        bundleId,
                        amount: '21.00',
                        network: 'MTN',
                        bundleType: 'DATA',
                        groupSizeGb: '5.00',
                        phoneNumber,
                        email: email || 'customer@example.com',
                        status: 'received',
                        isSandbox: false,
                        createdAt: new Date().toISOString()
                    };

                    orderDatabase.set(idempotencyKey, newOrder);

                    res.writeHead(201, { 'Content-Type': 'application/json', 'x-correlation-id': 'corr-ord-created' });
                    res.end(JSON.stringify({
                        success: true,
                        statusCode: 201,
                        message: 'Order placed and queued for processing.',
                        data: newOrder
                    }));
                    return;
                }

                // Route: POST /api/v1/agent/orders/bulk
                if (req.method === 'POST' && url.pathname === '/api/v1/agent/orders/bulk') {
                    const { network, recipients, idempotencyKey, onUnvalidated } = parsedBody || {};
                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        statusCode: 201,
                        message: 'Bulk order placed and queued for processing.',
                        data: {
                            id: `sub_01J${Date.now().toString().slice(-8)}`,
                            referenceCode: `BLK-7GH2K9ABCDEF`,
                            network,
                            amount: '48.00',
                            status: 'received',
                            createdAt: new Date().toISOString(),
                            beneficiaryCount: (recipients || []).length,
                            groupCount: 2,
                            orders: [
                                {
                                    id: 'ord_a123',
                                    publicId: 'ord_01J8AAA',
                                    referenceCode: 'TXN-AAA111',
                                    sizeGb: 2,
                                    beneficiaryCount: 1,
                                    amount: '8.40',
                                    status: 'received'
                                },
                                {
                                    id: 'ord_b456',
                                    publicId: 'ord_01J8BBB',
                                    referenceCode: 'TXN-BBB222',
                                    sizeGb: 5,
                                    beneficiaryCount: 1,
                                    amount: '21.00',
                                    status: 'received'
                                }
                            ],
                            blocked: onUnvalidated === 'set_aside' ? ['233559990000'] : []
                        }
                    }));
                    return;
                }

                // Route: GET /api/v1/agent/orders/:id
                if (req.method === 'GET' && url.pathname.startsWith('/api/v1/agent/orders/')) {
                    const orderId = decodeURIComponent(url.pathname.replace('/api/v1/agent/orders/', ''));
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        statusCode: 200,
                        message: 'Success',
                        data: {
                            id: orderId,
                            referenceCode: 'TXN-7GH2K9',
                            network: 'MTN',
                            status: 'approved',
                            paymentStatus: 'paid',
                            amount: '21.00',
                            groupSizeGb: 5,
                            submissionId: null,
                            createdAt: new Date().toISOString(),
                            approvedAt: new Date().toISOString(),
                            delivery: { approved: 1, pending: 0, failed: 0, total: 1 },
                            beneficiaries: [
                                {
                                    id: 'ben_001',
                                    phoneNumber: '0241234567',
                                    dataVolumeGb: '5.00',
                                    amount: '21.00',
                                    network: 'MTN',
                                    status: 'approved',
                                    isPorted: false
                                }
                            ]
                        }
                    }));
                    return;
                }

                // Route: GET /api/v1/agent/orders
                if (req.method === 'GET' && url.pathname === '/api/v1/agent/orders') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        statusCode: 200,
                        message: 'Success',
                        data: {
                            data: [
                                {
                                    id: 'ord_01J8XXX',
                                    referenceCode: 'TXN-7GH2K9',
                                    network: 'MTN',
                                    status: 'approved',
                                    paymentStatus: 'paid',
                                    amount: '21.00',
                                    groupSizeGb: 5,
                                    createdAt: new Date().toISOString(),
                                    delivery: { approved: 1, pending: 0, failed: 0, total: 1 },
                                    beneficiaries: []
                                }
                            ],
                            meta: { page: 1, limit: 30, total: 1, totalPages: 1 }
                        }
                    }));
                    return;
                }

                // Route: POST /api/v1/agent/beneficiaries/precheck
                if (req.method === 'POST' && url.pathname === '/api/v1/agent/beneficiaries/precheck') {
                    const { network, phoneNumbers, record } = parsedBody || {};
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        statusCode: 200,
                        message: 'Success',
                        data: {
                            network,
                            enforced: true,
                            sandbox: false,
                            recorded: Boolean(record),
                            summary: {
                                requested: (phoneNumbers || []).length,
                                unique: (phoneNumbers || []).length,
                                valid: (phoneNumbers || []).length,
                                invalid: 0,
                                known: 1,
                                unknown: (phoneNumbers || []).length - 1
                            },
                            unknown: (phoneNumbers || []).filter(p => !p.includes('241234567')),
                            results: (phoneNumbers || []).map(p => ({
                                phone: p,
                                normalized: p,
                                valid: true,
                                known: p.includes('241234567')
                            }))
                        }
                    }));
                    return;
                }

                // Route: GET /api/v1/agent/beneficiaries
                if (req.method === 'GET' && url.pathname === '/api/v1/agent/beneficiaries') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        statusCode: 200,
                        message: 'Success',
                        data: {
                            data: [
                                {
                                    msisdn: '0248336067',
                                    network: 'MTN',
                                    status: 'pending',
                                    attemptCount: 3,
                                    lastBundleSizeGb: '5',
                                    firstDetectedAt: '2026-08-10T09:15:00.000Z',
                                    lastDetectedAt: '2026-08-11T11:02:00.000Z'
                                }
                            ],
                            meta: { page: 1, limit: 30, total: 1 }
                        }
                    }));
                    return;
                }

                // Route: GET /api/v1/agent/wallet/balance
                if (req.method === 'GET' && url.pathname === '/api/v1/agent/wallet/balance') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        statusCode: 200,
                        message: 'Success',
                        data: {
                            balance: 1540.75,
                            currency: 'GHS',
                            overdraftLimit: 500,
                            overdraftUsed: 0,
                            overdraftAvailable: 500,
                            overdraftActive: true,
                            availableToSpend: 2040.75
                        }
                    }));
                    return;
                }

                // Route: GET /api/v1/agent/wallet/ledger
                if (req.method === 'GET' && url.pathname === '/api/v1/agent/wallet/ledger') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        statusCode: 200,
                        message: 'Success',
                        data: {
                            data: [
                                {
                                    id: 'le_01J8ABC',
                                    walletId: 'w_01J8XYZ',
                                    direction: 'debit',
                                    amount: '21.00',
                                    balanceAfter: '1540.75',
                                    balanceBefore: '1561.75',
                                    category: 'purchase',
                                    referenceType: 'Order',
                                    referenceId: 'ord_01J8...',
                                    description: 'Agent purchase of bundle',
                                    createdAt: new Date().toISOString()
                                }
                            ],
                            meta: { page: 1, limit: 50, total: 1 }
                        }
                    }));
                    return;
                }

                // 404 fallback
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }));
            });
        });

        mockServer.listen(MOCK_PORT, () => {
            resolve();
        });
    });
}

function stopMockServer() {
    return new Promise(resolve => {
        if (mockServer) mockServer.close(resolve);
        else resolve();
    });
}

async function runE2ETests() {
    process.env.DATAHOUSE_API_KEY = 'test_api_key_123';
    process.env.DATAHOUSE_API_BASE_URL = MOCK_BASE_URL;

    await startMockServer();
    console.log(`📡 Mock DataHouse API Server running on port ${MOCK_PORT} (Specification Aligned)\n`);

    const datahouse = require('../integrations/datahouse');

    try {
        // Test 1: Agent Profile Verification (GET /agent/me)
        console.log('--- Test 1: Agent Profile Verification (GET /agent/me) ---');
        const meRes = await datahouse.getAgentProfile();
        assert.strictEqual(meRes.ok, true);
        assert.strictEqual(meRes.data.status, 'approved');
        assert.strictEqual(meRes.data.pricePerGb, '4.20');
        console.log('✅ Agent profile verified (GET /agent/me): Key is valid, tier price GHS 4.20/GB.');

        // Test 2: Fetch Authoritative Bundle Catalog (GET /agent/bundles)
        console.log('\n--- Test 2: Authoritative Catalog Fetching (GET /agent/bundles) ---');
        const bundlesRes = await datahouse.getBundles({ refresh: true });
        assert.strictEqual(bundlesRes.ok, true);
        assert.strictEqual(bundlesRes.bundles.length, 3);
        assert.strictEqual(bundlesRes.bundles[1].dataVolume, '5GB');
        assert.strictEqual(bundlesRes.bundles[1].agentAmount, 21);
        console.log('✅ Catalog successfully fetched and normalized from DataHouse.');

        // Test 3: Create Single Order with Idempotency Key (POST /agent/orders)
        console.log('\n--- Test 3: Single Order Creation & Headers (POST /agent/orders) ---');
        const idempotencyKey = 'c7cc42cf-e7e4-4206-ac25-b34f720bdfb2';
        const singleOrderRes = await datahouse.createSingleOrder({
            bundleId: '550e8400-e29b-41d4-a716-446655440001',
            phoneNumber: '0241234567',
            idempotencyKey,
            email: 'customer@example.com'
        });
        assert.strictEqual(singleOrderRes.ok, true);
        assert.strictEqual(singleOrderRes.status, 201);
        assert.strictEqual(lastRequest.headers['x-api-key'], 'test_api_key_123');
        assert.strictEqual(lastRequest.body.idempotencyKey, idempotencyKey);
        assert.strictEqual(lastRequest.body.phoneNumber, '233241234567');
        assert.strictEqual(lastRequest.body.email, 'customer@example.com');
        console.log('✅ Single order successfully posted with x-api-key header and normalized phone.');

        // Test 4: Idempotent Order Retry returns existing order (POST /agent/orders)
        console.log('\n--- Test 4: Idempotent Order Retry ---');
        const retryRes = await datahouse.createSingleOrder({
            bundleId: '550e8400-e29b-41d4-a716-446655440001',
            phoneNumber: '0241234567',
            idempotencyKey
        });
        assert.strictEqual(retryRes.ok, true);
        assert.strictEqual(retryRes.data.id, singleOrderRes.data.id);
        console.log('✅ Repeated submission with same idempotency key returned existing order.');

        // Test 5: Beneficiary Precheck & Error Translation (Scenario C: 422 BENEFICIARY_NOT_VALIDATED)
        console.log('\n--- Test 5: Beneficiary Precheck & Error Translation ---');
        const precheckOrderRes = await datahouse.createSingleOrder({
            bundleId: '550e8400-e29b-41d4-a716-446655440001',
            phoneNumber: '0240000000' // Triggers 422 BENEFICIARY_NOT_VALIDATED
        });
        assert.strictEqual(precheckOrderRes.ok, false);
        assert.strictEqual(precheckOrderRes.status, 422);
        const translated = datahouse.translateDataHouseError(precheckOrderRes.error);
        assert.strictEqual(translated.code, 'BENEFICIARY_NOT_VALIDATED');
        console.log('✅ BENEFICIARY_NOT_VALIDATED error correctly caught and translated.');

        // Test 6: Bulk Order Submission (POST /agent/orders/bulk)
        console.log('\n--- Test 6: Bulk Order Submission (POST /agent/orders/bulk) ---');
        const bulkRes = await datahouse.createBulkOrder({
            network: 'MTN',
            recipients: [
                { phoneNumber: '0241112222', dataSizeGb: 2 },
                { phoneNumber: '0241234567', dataSizeGb: 5 }
            ],
            onUnvalidated: 'set_aside'
        });
        assert.strictEqual(bulkRes.ok, true);
        assert.strictEqual(bulkRes.status, 201);
        assert.strictEqual(lastRequest.body.recipients.length, 2);
        assert.strictEqual(lastRequest.body.recipients[0].phoneNumber, '233241112222');
        assert.strictEqual(lastRequest.body.recipients[0].dataSizeGb, 2);
        assert.strictEqual(bulkRes.data.orders.length, 2);
        assert.strictEqual(bulkRes.data.orders[0].publicId, 'ord_01J8AAA');
        console.log('✅ Bulk batch successfully formatted and submitted to DataHouse.');

        // Test 7: Beneficiaries Precheck API (POST /agent/beneficiaries/precheck)
        console.log('\n--- Test 7: Beneficiaries Precheck API (POST /agent/beneficiaries/precheck) ---');
        const precheckApiRes = await datahouse.precheckBeneficiaries({
            network: 'MTN',
            phoneNumbers: ['0241234567', '0559990000'],
            record: true
        });
        assert.strictEqual(precheckApiRes.ok, true);
        assert.strictEqual(precheckApiRes.recorded, true);
        assert.strictEqual(precheckApiRes.results.length, 2);
        assert.strictEqual(precheckApiRes.results[0].known, true);
        assert.strictEqual(precheckApiRes.results[1].known, false);
        console.log('✅ Precheck API successfully verified known vs unvalidated numbers with record: true.');

        // Test 8: MTN Approval Status List (GET /agent/beneficiaries)
        console.log('\n--- Test 8: MTN Approval Status List (GET /agent/beneficiaries) ---');
        const beneficiariesListRes = await datahouse.listBeneficiaries({ status: 'pending', network: 'MTN' });
        assert.strictEqual(beneficiariesListRes.ok, true);
        assert.strictEqual(beneficiariesListRes.data.data.length, 1);
        assert.strictEqual(beneficiariesListRes.data.data[0].status, 'pending');
        console.log('✅ MTN approval list retrieved from DataHouse GET /agent/beneficiaries.');

        // Test 9: Single Order Details Lookup (GET /agent/orders/:id)
        console.log('\n--- Test 9: Single Order Details Lookup (GET /agent/orders/:id) ---');
        const orderDetailsRes = await datahouse.getOrderById('ord_01J812345678');
        assert.strictEqual(orderDetailsRes.ok, true);
        assert.strictEqual(orderDetailsRes.data.status, 'approved');
        assert.strictEqual(orderDetailsRes.data.beneficiaries.length, 1);
        assert.strictEqual(orderDetailsRes.data.beneficiaries[0].phoneNumber, '0241234567');
        console.log('✅ Order details successfully retrieved with recipients from DataHouse GET /agent/orders/:id.');

        // Test 10: List Orders (GET /agent/orders)
        console.log('\n--- Test 10: List Orders (GET /agent/orders) ---');
        const ordersListRes = await datahouse.listOrders({ status: 'approved', network: 'MTN', limit: 30 });
        assert.strictEqual(ordersListRes.ok, true);
        assert.strictEqual(ordersListRes.data.data.length, 1);
        console.log('✅ List orders successfully retrieved with pagination and filters.');

        // Test 11: Agent Wallet Balance & Ledger (GET /agent/wallet/balance & ledger)
        console.log('\n--- Test 11: Agent Wallet Balance & Ledger ---');
        const walletBalRes = await datahouse.getWalletBalance();
        assert.strictEqual(walletBalRes.ok, true);
        assert.strictEqual(walletBalRes.balance, 1540.75);
        assert.strictEqual(walletBalRes.availableToSpend, 2040.75);

        const walletLedgerRes = await datahouse.getWalletLedger();
        assert.strictEqual(walletLedgerRes.ok, true);
        assert.strictEqual(walletLedgerRes.data.data.length, 1);
        assert.strictEqual(walletLedgerRes.data.data[0].balanceAfter, '1540.75');
        console.log('✅ Wallet balance & ledger retrieved: Balance GHS 1,540.75, Available to Spend GHS 2,040.75.');

        console.log('\n========================================================');
        console.log('🎉 100% SPECIFICATION ALIGNED: ALL DATAHOUSE API TESTS PASSED!');
        console.log('========================================================\n');

    } finally {
        await stopMockServer();
    }
}

runE2ETests().catch(async (err) => {
    console.error('❌ E2E Test Failure:', err);
    await stopMockServer();
    process.exit(1);
});
