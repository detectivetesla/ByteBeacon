/**
 * Centralized Configuration for Bulk Order Ingestion, Chunking, & Worker Concurrency
 */
module.exports = {
    // Maximum supported recipients in a single bulk submission (Default: 10,000)
    MAX_BULK_RECIPIENTS: parseInt(process.env.MAX_BULK_RECIPIENTS || '10000', 10),

    // Number of items per chunk sent to workers (Default: 100)
    BULK_CHUNK_SIZE: parseInt(process.env.BULK_CHUNK_SIZE || '100', 10),

    // Maximum concurrent worker jobs processing chunks simultaneously (Default: 5)
    ORDER_WORKER_CONCURRENCY: parseInt(process.env.ORDER_WORKER_CONCURRENCY || '5', 10),

    // Maximum retry attempts for transient worker failures (Default: 5)
    MAX_ITEM_ATTEMPTS: parseInt(process.env.MAX_ITEM_ATTEMPTS || '5', 10),

    // Heartbeat timeout for detecting stuck jobs (Default: 5 minutes)
    WATCHDOG_HEARTBEAT_TIMEOUT_MS: 5 * 60 * 1000,

    // Worker poll interval (Default: 2 seconds)
    WORKER_POLL_INTERVAL_MS: 2000,

    // DataHouse API rate limiting retry delay (Default: 2 seconds base, exponential backoff)
    RATE_LIMIT_BASE_DELAY_MS: 2000
};
