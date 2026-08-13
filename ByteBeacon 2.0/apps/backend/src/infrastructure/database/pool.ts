import pg from 'pg';
import { logger } from '../../core/logging/logger.js';

const { Pool } = pg;

export interface DatabaseConfig {
  connectionString: string;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

let poolInstance: pg.Pool | null = null;

export function createDatabasePool(config: DatabaseConfig): pg.Pool {
  if (poolInstance) {
    return poolInstance;
  }

  poolInstance = new Pool({
    connectionString: config.connectionString,
    max: config.maxConnections ?? 20,
    idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis ?? 5000,
  });

  poolInstance.on('error', (err) => {
    logger.error({ err }, 'Unexpected PostgreSQL pool background error');
  });

  return poolInstance;
}

export function getDatabasePool(): pg.Pool {
  if (!poolInstance) {
    throw new Error('Database pool has not been initialized. Call createDatabasePool first.');
  }
  return poolInstance;
}

export async function closeDatabasePool(): Promise<void> {
  if (poolInstance) {
    logger.info('Closing PostgreSQL database connection pool...');
    await poolInstance.end();
    poolInstance = null;
    logger.info('PostgreSQL pool closed.');
  }
}

export async function checkDatabaseHealth(): Promise<boolean> {
  if (!poolInstance) {
    return false;
  }
  try {
    const client = await poolInstance.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.warn({ err }, 'PostgreSQL health check failed');
    return false;
  }
}
