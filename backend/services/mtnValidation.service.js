const { precheckBeneficiaries, normalizePhone } = require('../integrations/datahouse');
const { recordPendingBeneficiary } = require('./mtnApproval.service');

/**
 * Validate beneficiary phone number BEFORE order creation, payment, or wallet debiting.
 *
 * Rules:
 * 1. Non-MTN networks: Always allowed.
 * 2. Invalid phone number: Allowed = false, error = 'Recipient phone number is invalid.'
 * 3. MTN known === true: Allowed = true.
 * 4. MTN known === false: Allowed = false, records/updates Pending MTN Approval workflow,
 *    returns status = 'pending_mtn_approval' with clear customer message. NO normal order created.
 */
const validateBeneficiaryBeforeOrder = async ({
    network,
    recipientPhone,
    bundleSize = 'Unknown',
    source = 'DASHBOARD',
    userId = null,
    agentId = null,
    agentStoreId = null,
    orderReference = null
}) => {
    if (!network || !recipientPhone) {
        return {
            allowed: false,
            status: 'invalid_request',
            error: 'Network and recipient phone number are required.'
        };
    }

    const netUpper = network.toUpperCase().trim();

    // 1. Non-MTN networks: allow order creation immediately
    if (netUpper !== 'MTN') {
        return { allowed: true };
    }

    // 2. Normalize MTN phone number
    const normalizedPhone = normalizePhone(recipientPhone);
    if (!normalizedPhone || normalizedPhone.length < 10) {
        return {
            allowed: false,
            status: 'invalid_phone',
            error: 'Recipient phone number is invalid.'
        };
    }

    // 3. Perform DataHouse precheck
    try {
        console.log(`🔍 [MTN PRECHECK GATE] Checking MTN recipient ${recipientPhone} for ${source}...`);
        const precheckRes = await precheckBeneficiaries({ network: 'MTN', phoneNumbers: [recipientPhone], enforce: true });

        if (!precheckRes.ok) {
            console.warn(`⚠️ [MTN PRECHECK GATE] DataHouse API check failed for ${recipientPhone}:`, precheckRes.error);
            
            await recordPendingBeneficiary({
                phone: recipientPhone,
                network: 'MTN',
                bundleSize,
                source,
                userId,
                agentId,
                agentStoreId,
                orderReference,
                datahouseSyncStatus: 'pending',
                datahouseSyncError: precheckRes.error?.message || 'Precheck API call failed'
            }).catch(() => {});

            return {
                allowed: false,
                status: 'precheck_unavailable',
                error: 'MTN verification is temporarily unavailable. Please try again shortly.'
            };
        }

        const results = precheckRes.results || [];
        const match = results.find(r => {
            const p = r.phone || r.normalized || r.phoneNumber || r.msisdn || '';
            return p === recipientPhone || p === normalizedPhone || normalizePhone(p) === normalizedPhone;
        }) || (results.length > 0 ? results[0] : null);

        if (!match) {
            return {
                allowed: false,
                status: 'precheck_unavailable',
                error: 'MTN verification is temporarily unavailable. Please try again shortly.'
            };
        }

        // Case A: Invalid phone number according to carrier
        if (match.valid === false) {
            return {
                allowed: false,
                status: 'invalid_phone',
                error: 'Recipient phone number is invalid.'
            };
        }

        // Case B: Known / Approved MTN beneficiary -> ALLOW ORDER CREATION
        if (match.known === true) {
            console.log(`✅ [MTN PRECHECK GATE] Recipient ${recipientPhone} is verified & known for MTN.`);
            return { allowed: true };
        }

        // Case C: Unknown / Unverified MTN beneficiary -> RECORD AND BLOCK ORDER CREATION
        console.log(`📱 [MTN PRECHECK GATE] Recipient ${recipientPhone} is UNVERIFIED MTN. Recording for approval.`);
        await recordPendingBeneficiary({
            phone: recipientPhone,
            network: 'MTN',
            bundleSize,
            source,
            userId,
            agentId,
            agentStoreId,
            orderReference,
            datahouseReference: match.reference || match.id || match.publicId || null,
            datahouseStatus: match.status || 'pending',
            datahouseSyncStatus: 'synced'
        }).catch(() => {});

        return {
            allowed: false,
            status: 'pending_mtn_approval',
            phone: recipientPhone,
            message: 'This recipient phone number is not yet approved on MTN. It has been recorded for approval. Your wallet has NOT been charged.'
        };

    } catch (err) {
        console.error('❌ [MTN PRECHECK GATE] Unexpected error during precheck:', err);
        return {
            allowed: false,
            status: 'precheck_error',
            error: 'Failed to verify MTN recipient status: ' + err.message
        };
    }
};

module.exports = {
    validateBeneficiaryBeforeOrder
};
