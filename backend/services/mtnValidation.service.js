const { precheckBeneficiary, normalizeGhanaPhone } = require('../utils/datahouse');
const { recordPendingBeneficiary } = require('./mtnApproval.service');

/**
 * Validate beneficiary phone number BEFORE order creation, payment, or wallet debiting.
 *
 * Rules:
 * 1. TELECEL (or any non-MTN network): Always allowed.
 * 2. Invalid phone number: Allowed = false, error = 'Recipient phone number is invalid.'
 * 3. MTN known === true: Allowed = true.
 * 4. MTN known === false: Allowed = false, records/updates Pending MTN Approval workflow,
 *    returns status = 'pending_mtn_approval' with clear customer message. NO normal order created.
 * 5. DataHouse API Error / Unavailable / Timeout: Allowed = false (FAIL CLOSED),
 *    returns status = 'precheck_unavailable', error = 'MTN verification is temporarily unavailable. Please try again shortly.'
 *
 * @param {Object} params
 * @param {string} params.network - Network name (e.g. 'MTN', 'TELECEL')
 * @param {string} params.recipientPhone - Recipient phone number
 * @param {string} [params.bundleSize] - Bundle size description (e.g. '5GB', '10GB')
 * @param {string} [params.source] - Order source (e.g. 'Web App', 'Agent Storefront', 'Partner API')
 * @param {string} [params.orderReference] - Optional reference code
 * @returns {Promise<{ allowed: boolean, status?: string, message?: string, error?: string, phone?: string }>}
 */
const validateBeneficiaryBeforeOrder = async ({
    network,
    recipientPhone,
    bundleSize = 'Unknown',
    source = 'Web App',
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

    // 1. TELECEL or non-MTN networks: allow order creation immediately
    if (netUpper !== 'MTN') {
        return { allowed: true };
    }

    // 2. Normalize MTN phone number
    const normalizedPhone = normalizeGhanaPhone(recipientPhone);
    if (!normalizedPhone || normalizedPhone.length < 10) {
        return {
            allowed: false,
            status: 'invalid_phone',
            error: 'Recipient phone number is invalid.'
        };
    }

    // 3. Perform DataHouse precheck with opt-in record=true
    try {
        console.log(`🔍 [MTN PRECHECK GATE] Checking MTN recipient ${recipientPhone} (normalized: ${normalizedPhone}) for ${source}...`);
        const precheckRes = await precheckBeneficiary('MTN', [recipientPhone], true);

        // Fail-closed if API response is not successful
        if (!precheckRes.success) {
            console.warn(`⚠️ [MTN PRECHECK GATE] DataHouse API check failed for ${recipientPhone}: ${precheckRes.error}. FAILING CLOSED.`);
            return {
                allowed: false,
                status: 'precheck_unavailable',
                error: 'MTN verification is temporarily unavailable. Please try again shortly.'
            };
        }

        const results = precheckRes.results || [];
        const match = results.find(r => {
            const p = r.phone || r.normalized || r.phoneNumber || r.msisdn || '';
            return p === recipientPhone || p === normalizedPhone || normalizeGhanaPhone(p) === normalizedPhone;
        }) || (results.length > 0 ? results[0] : null);

        if (!match) {
            console.warn(`⚠️ [MTN PRECHECK GATE] No match found in results for ${recipientPhone}. FAILING CLOSED.`);
            return {
                allowed: false,
                status: 'precheck_unavailable',
                error: 'MTN verification is temporarily unavailable. Please try again shortly.'
            };
        }

        // Case A: Invalid phone number according to provider
        if (match.valid === false) {
            console.log(`⛔ [MTN PRECHECK GATE] Recipient ${recipientPhone} marked invalid by provider.`);
            return {
                allowed: false,
                status: 'invalid_phone',
                error: 'Recipient phone number is invalid.'
            };
        }

        // Case B: Known / Approved MTN beneficiary -> ALLOW ORDER CREATION
        if (match.known === true) {
            console.log(`✅ [MTN PRECHECK GATE] Recipient ${recipientPhone} is verified & known for MTN. Order allowed.`);
            return { allowed: true };
        }

        // Case C: Unknown / Unverified MTN beneficiary -> BLOCK ORDER CREATION
        if (match.known === false) {
            console.log(`📱 [MTN PRECHECK GATE] Recipient ${recipientPhone} is UNVERIFIED (known: false). Blocking normal order flow & recording in Pending MTN Approvals.`);

            // Record / Update in mtn_beneficiary_approvals with deduplication
            await recordPendingBeneficiary({
                phone: recipientPhone,
                network: 'MTN',
                bundleSize,
                source,
                orderReference
            }).catch(recordErr => console.warn('⚠️ Record pending beneficiary warning:', recordErr.message));

            return {
                allowed: false,
                status: 'pending_mtn_approval',
                message: `⚠️ MTN Number Pending Approval\n\nThe recipient number ${recipientPhone} has not yet been approved by MTN for data delivery through our network.\n\nYour order has NOT been placed and you have NOT been charged.\n\nThe number has been automatically submitted for MTN approval. You do not need to do anything else. Once approved, you can return and place the order normally.`,
                phone: recipientPhone
            };
        }

        // Default fallback if known status is ambiguous: Fail closed
        return {
            allowed: false,
            status: 'precheck_unavailable',
            error: 'MTN verification status could not be determined. Please try again shortly.'
        };

    } catch (err) {
        console.error(`❌ [MTN PRECHECK GATE] Unexpected error validating ${recipientPhone}:`, err.message);
        return {
            allowed: false,
            status: 'precheck_unavailable',
            error: 'MTN verification is temporarily unavailable. Please try again shortly.'
        };
    }
};

module.exports = {
    validateBeneficiaryBeforeOrder
};
