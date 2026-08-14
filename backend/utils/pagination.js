/**
 * Unified System-Wide Pagination Engine
 * Standardizes API pagination across all ByteBeacon and DataHouse endpoints.
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/**
 * Parse and validate pagination parameters from Express request query
 *
 * @param {Object} query - req.query object
 * @param {Object} [options]
 * @param {number} [options.defaultPage=1]
 * @param {number} [options.defaultLimit=25]
 * @param {number} [options.maxLimit=100]
 * @param {Object} [options.allowedSortFields] - Map of camelCase key to SQL column
 * @param {string} [options.defaultSort='created_at DESC']
 * @returns {{ page: number, limit: number, offset: number, sortSql: string, sortBy: string, sortOrder: string }}
 */
function parsePagination(query = {}, options = {}) {
    const defaultPage = options.defaultPage || DEFAULT_PAGE;
    const defaultLimit = options.defaultLimit || DEFAULT_LIMIT;
    const maxLimit = options.maxLimit || MAX_LIMIT;

    // Sanitize Page
    let rawPage = parseInt(query.page || query.p, 10);
    const page = isNaN(rawPage) || rawPage < 1 ? defaultPage : rawPage;

    // Sanitize Limit (Bounded between 1 and maxLimit)
    let rawLimit = parseInt(query.limit || query.pageSize || query.perPage, 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? defaultLimit : Math.min(rawLimit, maxLimit);

    // Compute SQL Offset
    const offset = (page - 1) * limit;

    // Sanitize Sorting (Strict Whitelist to prevent SQL Injection)
    const allowedSortFields = options.allowedSortFields || {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        amount: 'amount_ghc',
        status: 'status',
        network: 'network',
        phone: 'recipient_phone'
    };

    const requestedSortBy = query.sortBy || query.sort;
    const requestedSortOrder = String(query.sortOrder || query.order || 'DESC').toUpperCase();
    const sortOrder = requestedSortOrder === 'ASC' ? 'ASC' : 'DESC';

    let sortSql = options.defaultSort || 'created_at DESC';
    let activeSortBy = 'createdAt';

    if (requestedSortBy && allowedSortFields[requestedSortBy]) {
        activeSortBy = requestedSortBy;
        sortSql = `${allowedSortFields[requestedSortBy]} ${sortOrder}`;
    }

    return {
        page,
        limit,
        offset,
        sortSql,
        sortBy: activeSortBy,
        sortOrder
    };
}

/**
 * Build standard paginated response envelope
 *
 * @param {Array} data - Array of records
 * @param {number} total - Total count of matching records across all pages
 * @param {number} page - Current page
 * @param {number} limit - Records per page
 * @returns {{ data: Array, pagination: { page: number, limit: number, total: number, totalPages: number, hasNextPage: boolean, hasPreviousPage: boolean } }}
 */
function buildPaginatedResponse(data = [], total = 0, page = 1, limit = 25) {
    const safeTotal = Math.max(0, parseInt(total, 10) || 0);
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.max(1, parseInt(limit, 10) || 25);
    const totalPages = Math.ceil(safeTotal / safeLimit) || 1;

    return {
        data: Array.isArray(data) ? data : [],
        pagination: {
            page: safePage,
            limit: safeLimit,
            total: safeTotal,
            totalPages,
            hasNextPage: safePage < totalPages,
            hasPreviousPage: safePage > 1
        }
    };
}

module.exports = {
    parsePagination,
    buildPaginatedResponse,
    DEFAULT_PAGE,
    DEFAULT_LIMIT,
    MAX_LIMIT
};
