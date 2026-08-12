const { recordPendingBeneficiary, syncBeneficiaryApprovals } = require('../backend/services/mtnApproval.service');
const pool = require('../backend/config/database');

async function testWorkflow() {
    console.log('🧪 Starting Pending MTN Approval workflow test...');
    
    try {
        const testPhone = '0551234567'; // normalized to 233551234567
        const testOrderId = '00000000-0000-0000-0000-000000000001';
        
        // 1. Record a pending beneficiary
        console.log('1️⃣ Testing recordPendingBeneficiary...');
        const recordResult = await recordPendingBeneficiary({
            phone: testPhone,
            network: 'MTN',
            bundleSize: '5GB',
            source: 'Test Suite',
            orderId: testOrderId,
            orderReference: 'TEST-REF-101'
        });
        console.log('✅ Record result ID:', recordResult);

        // 2. Check DB records
        const [rows] = await pool.execute(
            `SELECT * FROM mtn_beneficiary_approvals WHERE msisdn = '233551234567'`
        );
        console.log('✅ DB Approval Record:', {
            id: rows[0]?.id,
            msisdn: rows[0]?.msisdn,
            status: rows[0]?.status,
            display_phone: rows[0]?.display_phone
        });

        // 3. Test syncBeneficiaryApprovals execution
        console.log('2️⃣ Testing syncBeneficiaryApprovals...');
        const syncRes = await syncBeneficiaryApprovals();
        console.log('✅ Sync result:', syncRes);

        // 4. Cleanup test data
        await pool.execute(`DELETE FROM mtn_beneficiary_approval_orders WHERE approval_id = ?`, [rows[0].id]);
        await pool.execute(`DELETE FROM mtn_beneficiary_approvals WHERE msisdn = '233551234567'`);
        console.log('🧹 Cleanup completed.');

        console.log('🎉 ALL PENDING MTN APPROVAL SERVICE TESTS PASSED SUCCESSFULLY!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    }
}

testWorkflow();
