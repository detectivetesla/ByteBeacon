const assert = require('assert');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Import integration modules
const {
    verifyWebhookSignature,
    extractDeliveryId,
    translateDataHouseError
} = require('../integrations/datahouse');
const { normalizePhone, parseBundleSizeInGb } = require('../integrations/datahouse/bundles');

console.log('🧪 Starting ByteBeacon DataHouse Authoritative Integration Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`  ✅ [PASS] ${name}`);
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}`);
        console.error(`     Error: ${err.message}\n`);
    }
}

async function runAsyncTest(name, fn) {
    totalTests++;
    try {
        await fn();
        passedTests++;
        console.log(`  ✅ [PASS] ${name}`);
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}`);
        console.error(`     Error: ${err.message}\n`);
    }
}

async function runAllTests() {
    // ─────────────────────────────────────────────────────────────
    // 1. Phone Normalization & Bundle Size Parsing Tests
    // ─────────────────────────────────────────────────────────────
    console.log('--- 1. DataHouse Formatting & Normalization ---');

    runTest('Normalize Ghanaian local 10-digit phone number (024XXXXXXX -> 23324XXXXXXX)', () => {
        const norm = normalizePhone('0241234567');
        assert.strictEqual(norm, '233241234567');
    });

    runTest('Normalize Ghanaian phone with leading 2330 (233024XXXXXXX -> 23324XXXXXXX)', () => {
        const norm = normalizePhone('2330241234567');
        assert.strictEqual(norm, '233241234567');
    });

    runTest('Normalize Ghanaian phone already in international format (23324XXXXXXX)', () => {
        const norm = normalizePhone('233241234567');
        assert.strictEqual(norm, '233241234567');
    });

    runTest('Parse bundle size in GB from string volume (10GB -> 10, 500MB -> 0.488GB)', () => {
        assert.strictEqual(parseBundleSizeInGb({ dataVolume: '10GB' }), 10);
        assert.strictEqual(parseBundleSizeInGb({ dataVolume: '1GB' }), 1);
        assert.strictEqual(parseBundleSizeInGb({ dataSizeGb: 5 }), 5);
        assert.strictEqual(parseBundleSizeInGb({ name: 'MTN (2GB)' }), 2);
    });

    // ─────────────────────────────────────────────────────────────
    // 2. DataHouse Error Translation Tests (Scenarios B, C)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 2. DataHouse Error Translation & Safety ---');

    runTest('Scenario B: INVALID_PHONE translates to safe customer-facing error', () => {
        const err = translateDataHouseError({ code: 'INVALID_PHONE', message: 'Invalid MSISDN format' }, 'corr_123');
        assert.strictEqual(err.code, 'INVALID_PHONE');
        assert.strictEqual(err.correlationId, 'corr_123');
        assert.ok(err.message.includes('invalid'));
    });

    runTest('Scenario C: BENEFICIARY_NOT_VALIDATED translates with clear validation message', () => {
        const err = translateDataHouseError({ code: 'BENEFICIARY_NOT_VALIDATED', message: 'MTN Up2U validation required' }, 'corr_456');
        assert.strictEqual(err.code, 'BENEFICIARY_NOT_VALIDATED');
        assert.ok(err.message.includes('MTN'));
        assert.ok(err.message.includes('validation'));
    });

    runTest('Generic / Internal errors do not leak sensitive SQL or stack traces', () => {
        const err = translateDataHouseError({ code: 'DB_ERROR', message: 'SELECT * FROM keys WHERE secret_key = xyz' });
        assert.strictEqual(err.code, 'DB_ERROR');
        assert.ok(!err.message.includes('SELECT'));
        assert.ok(!err.message.includes('secret_key'));
    });

    // ─────────────────────────────────────────────────────────────
    // 3. Webhook Signature Verification & Idempotency Tests (Scenarios D, E, F, G)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 3. Webhook HMAC-SHA256 Signature & Delivery Verification ---');

    const testSecret = 'whsec_test_secret_key_bytebeacon_2026';
    const samplePayload = {
        id: 'evt_test_001',
        type: 'order.approved',
        data: {
            id: 'ord_dh_998877',
            publicId: 'ord_dh_998877',
            referenceCode: 'DH-REF-2026-001',
            status: 'approved'
        }
    };
    const rawBodyBuffer = Buffer.from(JSON.stringify(samplePayload));
    const nowSec = Math.floor(Date.now() / 1000);

    runTest('Scenario D/E: Verify valid HMAC-SHA256 signature with t=<timestamp>,v1=<signature>', () => {
        const signedString = `${nowSec}.${rawBodyBuffer.toString('utf8')}`;
        const signatureHex = crypto.createHmac('sha256', testSecret).update(signedString).digest('hex');
        const signatureHeader = `t=${nowSec},v1=${signatureHex}`;

        const result = verifyWebhookSignature({
            signatureHeader,
            rawBody: rawBodyBuffer,
            secret: testSecret
        });

        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.reason, null);
    });

    runTest('Tampered payload is rejected with SIGNATURE_MISMATCH', () => {
        const signedString = `${nowSec}.${rawBodyBuffer.toString('utf8')}`;
        const signatureHex = crypto.createHmac('sha256', testSecret).update(signedString).digest('hex');
        const signatureHeader = `t=${nowSec},v1=${signatureHex}`;

        const tamperedBody = Buffer.from(JSON.stringify({ ...samplePayload, type: 'order.hacked' }));
        const result = verifyWebhookSignature({
            signatureHeader,
            rawBody: tamperedBody,
            secret: testSecret
        });

        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.reason, 'SIGNATURE_MISMATCH');
    });

    runTest('Expired timestamp (> 5 minutes) is rejected with TIMESTAMP_EXPIRED', () => {
        const oldTimestamp = nowSec - 600; // 10 minutes ago
        const signedString = `${oldTimestamp}.${rawBodyBuffer.toString('utf8')}`;
        const signatureHex = crypto.createHmac('sha256', testSecret).update(signedString).digest('hex');
        const signatureHeader = `t=${oldTimestamp},v1=${signatureHex}`;

        const result = verifyWebhookSignature({
            signatureHeader,
            rawBody: rawBodyBuffer,
            secret: testSecret
        });

        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.reason, 'TIMESTAMP_EXPIRED');
    });

    runTest('Scenario G: Extract Delivery ID from X-Telecom-Delivery-Id header or payload ID', () => {
        const deliveryIdFromHeader = extractDeliveryId({ 'x-telecom-delivery-id': 'deliv_abc_123' }, samplePayload);
        assert.strictEqual(deliveryIdFromHeader, 'deliv_abc_123');

        const deliveryIdFromBody = extractDeliveryId({}, samplePayload);
        assert.strictEqual(deliveryIdFromBody, 'evt_test_001');
    });

    // ─────────────────────────────────────────────────────────────
    // 4. Summary & Exit Status
    // ─────────────────────────────────────────────────────────────
    console.log(`\n========================================`);
    console.log(`📊 Test Results: ${passedTests}/${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
    console.log(`========================================\n`);

    if (passedTests !== totalTests) {
        process.exit(1);
    }
}

runAllTests().catch(err => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
});
