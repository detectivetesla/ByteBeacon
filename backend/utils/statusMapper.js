/**
 * Centralized Order Status Mapper
 * Single source of truth for translating upstream provider responses (DataHouse / Portal-02)
 * into internal application order states.
 */

// Canonical Internal Order States
const INTERNAL_STATUS = {
    RECEIVED: 'received',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    PARTIALLY_APPROVED: 'partially_approved',
    REJECTED: 'rejected',
    FAILED: 'failed',
    REFUNDED: 'refunded',
    PENDING_MTN_APPROVAL: 'pending_mtn_approval'
};

/**
 * Maps upstream status strings, HTTP status codes, and error codes into internal order states.
 */
const mapProviderStatusToInternal = ({ providerStatus, statusCode, errorCode, errorMessage, data }) => {
    // 1. Check for MTN Beneficiary Not Validated (HTTP 422 or error code)
    const errCode = (errorCode || '').toUpperCase();
    const errStr = (errorMessage || JSON.stringify(data || '')).toLowerCase();

    if (
        statusCode === 422 ||
        errCode === 'BENEFICIARY_NOT_VALIDATED' ||
        errStr.includes('beneficiary_not_validated') ||
        errStr.includes('not validated') ||
        errStr.includes('awaiting mtn approval') ||
        errStr.includes('pending mtn approval')
    ) {
        return INTERNAL_STATUS.PENDING_MTN_APPROVAL;
    }

    // 2. Check provider status string
    const status = (providerStatus || '').toLowerCase().trim();

    if (['completed', 'success', 'delivered', 'fulfilled', 'resolved', 'delivered_callback'].includes(status)) {
        return INTERNAL_STATUS.COMPLETED;
    }

    if (['partially_approved', 'partially_fulfilled', 'partial_success'].includes(status)) {
        return INTERNAL_STATUS.PARTIALLY_APPROVED;
    }

    if (['rejected', 'order.rejected'].includes(status)) {
        return INTERNAL_STATUS.REJECTED;
    }

    if (['refunded', 'purchase.refunded'].includes(status)) {
        return INTERNAL_STATUS.REFUNDED;
    }

    if (['failed', 'error', 'cancelled', 'failed_callback', 'purchase.failed', 'could_not_deliver', 'fulfillment_failed'].includes(status)) {
        return INTERNAL_STATUS.FAILED;
    }

    if (['received', 'queued', 'pending', 'processing', 'order.received', 'order.processing'].includes(status)) {
        return INTERNAL_STATUS.PROCESSING;
    }

    // 3. Fallback based on HTTP status code
    if (statusCode === 201 || statusCode === 200) {
        return INTERNAL_STATUS.PROCESSING;
    }

    return INTERNAL_STATUS.FAILED;
};

module.exports = {
    INTERNAL_STATUS,
    mapProviderStatusToInternal
};
