import { createApp } from './app.js';
import { getConfig } from './config/env.js';
import { logger } from './core/logging/logger.js';
import { createDatabasePool, closeDatabasePool } from './infrastructure/database/pool.js';
import { createRedisClient, closeRedisClient } from './infrastructure/redis/client.js';

let isShuttingDown = false;

export async function startServer() {
  const config = getConfig();

  // Initialize infrastructure clients
  createDatabasePool({ connectionString: config.DATABASE_URL });
  createRedisClient({ url: config.REDIS_URL });

  const app = createApp({ config });

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn(`Shutdown already in progress. Ignoring additional ${signal} signal.`);
      return;
    }
    isShuttingDown = true;
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);

    const shutdownTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcing process exit.');
      process.exit(1);
    }, 10000);

    try {
      // 1. Stop accepting new HTTP requests & close Fastify
      logger.info('Closing HTTP server...');
      await app.close();
      logger.info('HTTP server closed.');

      // 2. Close Redis
      await closeRedisClient();

      // 3. Close Postgres pool
      await closeDatabasePool();

      clearTimeout(shutdownTimeout);
      logger.info('Graceful shutdown completed successfully.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during graceful shutdown');
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    const address = await app.listen({ port: config.PORT, host: '0.0.0.0' });
    logger.info(`ByteBeacon 2.0 backend server listening at ${address} [ENV: ${config.NODE_ENV}]`);
    return app;
  } catch (err) {
    logger.error({ err }, 'Fatal error starting ByteBeacon backend server');
    await shutdown('STARTUP_ERROR');
    throw err;
  }
}
