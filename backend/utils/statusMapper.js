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

    // Check for explicit rejection / invalid phone number
    if (
        errCode === 'INVALID_PHONE' ||
        errCode === 'NUMBER_BLOCKED' ||
        errCode === 'REJECTED' ||
        errStr.includes('invalid_phone') ||
        errStr.includes('invalid phone') ||
        errStr.includes('number blocked') ||
        errStr.includes('rejected by network')
    ) {
        return INTERNAL_STATUS.REJECTED;
    }

    // 2. Check provider status string
    const status = (providerStatus || '').toLowerCase().trim();

    if (['completed', 'success', 'delivered', 'fulfilled', 'resolved', 'delivered_callback', 'approved', 'order.approved'].includes(status)) {
        return INTERNAL_STATUS.COMPLETED;
    }

    if (['partially_approved', 'partially_fulfilled', 'partial_success'].includes(status)) {
        return INTERNAL_STATUS.PARTIALLY_APPROVED;
    }

    if (['rejected', 'order.rejected', 'invalid', 'blocked'].includes(status)) {
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

const TERMINAL_STATUSES = new Set(['completed', 'fulfilled', 'rejected', 'failed', 'refunded', 'partially_approved']);

const isTerminalStatus = (status) => {
    return TERMINAL_STATUSES.has((status || '').toLowerCase().trim());
};

const isValidStatusTransition = (currentStatus, newStatus) => {
    const current = (currentStatus || '').toLowerCase().trim();
    const target = (newStatus || '').toLowerCase().trim();

    if (!current || current === target) return true; // Idempotent or uninitialized

    // If current status is terminal, prevent regression to non-terminal states
    if (TERMINAL_STATUSES.has(current)) {
        if (!TERMINAL_STATUSES.has(target)) {
            console.warn(`🛡️ [STATUS GUARD] Blocked invalid status regression from terminal "${current}" to non-terminal "${target}".`);
            return false;
        }
        // Allow transition from failed/rejected to refunded
        if (target === INTERNAL_STATUS.REFUNDED) return true;
        // Block other terminal-to-terminal changes like completed -> failed/processing
        if (current === INTERNAL_STATUS.COMPLETED && target !== INTERNAL_STATUS.COMPLETED) {
            console.warn(`🛡️ [STATUS GUARD] Blocked changing completed order from "${current}" to "${target}".`);
            return false;
        }
    }

    return true;
};

module.exports = {
    INTERNAL_STATUS,
    mapProviderStatusToInternal,
    isTerminalStatus,
    isValidStatusTransition
};
