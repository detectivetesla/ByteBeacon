import crypto from 'node:crypto';
import type pg from 'pg';
import type Redis from 'ioredis';
import { ConflictError } from '../errors/app-error.js';

export interface IdempotencyRecord {
  key: string;
  userId: string;
  endpoint: string;
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
  createdAt: Date;
  expiresAt: Date;
}

export class IdempotencyService {
  private readonly db: pg.Pool;
  private readonly redis: Redis | null;
  private readonly defaultTtlSeconds: number;

  constructor(db: pg.Pool, redis: Redis | null = null, defaultTtlSeconds = 86400) {
    this.db = db;
    this.redis = redis;
    this.defaultTtlSeconds = defaultTtlSeconds;
  }

  public computeHash(payload: unknown): string {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  public async getExistingResponse(
    key: string,
    userId: string,
    currentRequestHash: string,
  ): Promise<{ exists: boolean; status?: number; body?: unknown }> {
    // 1. Redis Acceleration Check
    if (this.redis) {
      const redisKey = `idempotency:${userId}:${key}`;
      const cached = await this.redis.get(redisKey);
      if (cached) {
        const parsed = JSON.parse(cached) as {
          requestHash: string;
          status: number;
          body: unknown;
        };

        if (parsed.requestHash !== currentRequestHash) {
          throw new ConflictError(
            'Idempotency key collision: This key was previously used with a different request payload',
          );
        }

        return { exists: true, status: parsed.status, body: parsed.body };
      }
    }

    // 2. PostgreSQL Durable Check
    const query = `
      SELECT request_hash as "requestHash", response_status as "responseStatus", response_body as "responseBody", expires_at as "expiresAt"
      FROM idempotency_keys
      WHERE key = $1 AND user_id = $2
    `;

    const result = await this.db.query<{
      requestHash: string;
      responseStatus: number;
      responseBody: unknown;
      expiresAt: Date;
    }>(query, [key, userId]);

    if (result.rows.length === 0) {
      return { exists: false };
    }

    const row = result.rows[0];

    if (new Date(row.expiresAt) < new Date()) {
      return { exists: false };
    }

    if (row.requestHash !== currentRequestHash) {
      throw new ConflictError(
        'Idempotency key collision: This key was previously used with a different request payload',
      );
    }

    return { exists: true, status: row.responseStatus, body: row.responseBody };
  }

  public async saveResponse(
    client: pg.PoolClient | pg.Pool,
    params: {
      key: string;
      userId: string;
      endpoint: string;
      requestHash: string;
      responseStatus: number;
      responseBody: unknown;
      ttlSeconds?: number;
    },
  ): Promise<void> {
    const ttl = params.ttlSeconds || this.defaultTtlSeconds;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const query = `
      INSERT INTO idempotency_keys (key, user_id, endpoint, request_hash, response_status, response_body, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (key, user_id) DO UPDATE
      SET response_status = EXCLUDED.response_status,
          response_body = EXCLUDED.response_body,
          expires_at = EXCLUDED.expires_at
    `;

    await client.query(query, [
      params.key,
      params.userId,
      params.endpoint,
      params.requestHash,
      params.responseStatus,
      JSON.stringify(params.responseBody),
      expiresAt,
    ]);

    // Cache in Redis for fast future lookups
    if (this.redis) {
      const redisKey = `idempotency:${params.userId}:${params.key}`;
      await this.redis.setex(
        redisKey,
        ttl,
        JSON.stringify({
          requestHash: params.requestHash,
          status: params.responseStatus,
          body: params.responseBody,
        }),
      );
    }
  }
}
