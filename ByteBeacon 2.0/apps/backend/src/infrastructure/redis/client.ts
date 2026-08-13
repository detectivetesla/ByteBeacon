import { Redis } from 'ioredis';
import { logger } from '../../core/logging/logger.js';

export interface RedisConfig {
  url: string;
}

let redisInstance: Redis | null = null;

export function createRedisClient(config: RedisConfig): Redis {
  if (redisInstance) {
    return redisInstance;
  }

  redisInstance = new Redis(config.url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
  });

  redisInstance.on('error', (err) => {
    logger.error({ err }, 'Redis connection background error');
  });

  redisInstance.on('connect', () => {
    logger.info('Connected to Redis instance');
  });

  return redisInstance;
}

export function getRedisClient(): Redis {
  if (!redisInstance) {
    throw new Error('Redis client has not been initialized. Call createRedisClient first.');
  }
  return redisInstance;
}

export async function closeRedisClient(): Promise<void> {
  if (redisInstance) {
    logger.info('Closing Redis client...');
    try {
      await redisInstance.quit();
    } catch {
      redisInstance.disconnect();
    }
    redisInstance = null;
    logger.info('Redis client closed.');
  }
}

export async function checkRedisHealth(): Promise<boolean> {
  if (!redisInstance) {
    return false;
  }
  try {
    const res = await redisInstance.ping();
    return res === 'PONG';
  } catch (err) {
    logger.warn({ err }, 'Redis health check failed');
    return false;
  }
}
