/**
 * Standardized DataHouse Error Handling & Safe Error Translation
 *
 * Preserves the underlying DataHouse error code internally for auditing and debugging,
 * while mapping to clear, friendly customer-facing error messages.
 */

const ERROR_MESSAGE_MAP = {
    'BENEFICIARY_NOT_VALIDATED': "This recipient's MTN number requires validation before data can be delivered. It has been recorded for MTN approval.",
    'INVALID_PHONE': 'The recipient phone number provided is invalid. Please verify the phone number format.',
    'AGENT_INACTIVE': 'Telecom ordering is temporarily inactive for maintenance. Please try again shortly.',
    'INSUFFICIENT_BALANCE': 'Agent wallet balance is insufficient to process this order.',
    'INSUFFICIENT_FUNDS': 'Agent wallet balance is insufficient to process this order.',
    'BUNDLE_NOT_FOUND': 'The requested data bundle does not exist or has been discontinued.',
    'BUNDLE_INACTIVE': 'The requested data bundle is currently inactive.',
    'BULK_NOT_ON_SANDBOX': 'Bulk orders are not available on sandbox API keys.',
    'ORDER_DUPLICATE': 'A duplicate order with this idempotency key was already submitted.',
    'RATE_LIMITED': 'Telecom system rate limit reached. High traffic in progress. Please wait a few moments before retrying.',
    'UNAUTHORIZED': 'Authentication with the telecom provider failed.',
    'FORBIDDEN': 'Access to this telecom resource is restricted.',
    'TIMEOUT': 'DataHouse service is temporarily unavailable or timed out. Please try again shortly.',
    'INTERNAL_ERROR': 'A carrier-level error occurred while processing the order.'
};

/**
 * Translate a DataHouse error into a safe customer-facing payload
 *
 * @param {Object} datahouseError - { code: string, message: string }
 * @param {string|null} [correlationId]
 * @returns {{ code: string, message: string, correlationId: string|null }}
 */
function translateDataHouseError(datahouseError, correlationId = null) {
    if (!datahouseError) {
        return {
            code: 'UNKNOWN_ERROR',
            message: 'An unexpected telecom processing error occurred.',
            correlationId
        };
    }

    const rawCode = (datahouseError.code || 'TELECOM_ERROR').toUpperCase();
    const rawMessage = datahouseError.message || '';

    // Find mapped message or fall back to sanitized version of the carrier message
    const userMessage = ERROR_MESSAGE_MAP[rawCode] || (rawMessage && !rawMessage.toLowerCase().includes('sql') && !rawMessage.toLowerCase().includes('key') ? rawMessage : 'The telecom order could not be completed.');

    return {
        code: rawCode,
        message: userMessage,
        correlationId
    };
}

module.exports = {
    translateDataHouseError,
    ERROR_MESSAGE_MAP
};
