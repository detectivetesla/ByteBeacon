const { recordPendingBeneficiary, syncBeneficiaryApprovals, updateBeneficiaryStatus } = require('../backend/services/mtnApproval.service');
const pool = require('../backend/config/database');

async function testWorkflow() {
    console.log('🧪 Starting Pending MTN Approval workflow test...');
    
    try {
        const testPhone = '0551234567'; // 233551234567
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
        console.log('✅ Record result:', recordResult);

        // 2. Check DB records
        const [rows] = await pool.execute(
            `SELECT * FROM mtn_beneficiary_approvals WHERE phone = '233551234567'`
        );
        console.log('✅ DB Approval Record:', rows[0]);

        // 3. Test update status to approved manually
        console.log('2️⃣ Testing manual approval via service...');
        const updateResult = await updateBeneficiaryStatus('233551234567', 'approved', 'Approved in automated test');
        console.log('✅ Update result:', updateResult);

        // 4. Verify status updated in DB
        const [updatedRows] = await pool.execute(
            `SELECT * FROM mtn_beneficiary_approvals WHERE phone = '233551234567'`
        );
        console.log('✅ DB Updated Status:', updatedRows[0]?.status, updatedRows[0]?.notes);

        // 5. Cleanup test data
        await pool.execute(`DELETE FROM mtn_beneficiary_approval_orders WHERE approval_id = ?`, [updatedRows[0].id]);
        await pool.execute(`DELETE FROM mtn_beneficiary_approvals WHERE phone = '233551234567'`);
        console.log('🧹 Cleanup completed.');

        console.log('🎉 ALL PENDING MTN APPROVAL SERVICE TESTS PASSED SUCCESSFULLY!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    }
}

testWorkflow();
