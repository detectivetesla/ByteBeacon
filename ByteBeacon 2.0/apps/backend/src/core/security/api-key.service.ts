import crypto from 'node:crypto';
import type pg from 'pg';
import { ApiKeyEnvironment, ApiKeyStatus, Permission } from '@bytebeacon/shared';
import { UnauthorizedError, ForbiddenError } from '../errors/app-error.js';

export interface CreateApiKeyParams {
  agentId: string;
  name: string;
  environment: ApiKeyEnvironment;
  scopes: Permission[];
  expiresInDays?: number;
}

export interface GeneratedApiKeyResult {
  id: string;
  name: string;
  keyPrefix: string;
  rawApiKey: string; // Shown only ONCE
  environment: ApiKeyEnvironment;
  scopes: Permission[];
  createdAt: Date;
  expiresAt: Date | null;
}

export interface ValidatedApiKeyResult {
  id: string;
  agentId: string;
  name: string;
  environment: ApiKeyEnvironment;
  scopes: Permission[];
  rateLimitTier: string;
}

export class ApiKeyService {
  private readonly db: pg.Pool;

  constructor(db: pg.Pool) {
    this.db = db;
  }

  public async generateApiKey(params: CreateApiKeyParams): Promise<GeneratedApiKeyResult> {
    const prefixType = params.environment === ApiKeyEnvironment.LIVE ? 'ak_live' : 'ak_test';
    const randomEntropy = crypto.randomBytes(24).toString('base64url');
    const rawApiKey = `${prefixType}_${randomEntropy}`;

    const keyPrefix = rawApiKey.substring(0, 16);
    const keyHash = this.hashKey(rawApiKey);

    const expiresAt = params.expiresInDays
      ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const query = `
      INSERT INTO api_keys (agent_id, name, key_prefix, key_hash, environment, scopes, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, key_prefix as "keyPrefix", environment, scopes,
                created_at as "createdAt", expires_at as "expiresAt"
    `;

    const result = await this.db.query<{
      id: string;
      name: string;
      keyPrefix: string;
      environment: ApiKeyEnvironment;
      scopes: Permission[];
      createdAt: Date;
      expiresAt: Date | null;
    }>(query, [
      params.agentId,
      params.name,
      keyPrefix,
      keyHash,
      params.environment,
      params.scopes,
      expiresAt,
    ]);

    const row = result.rows[0];

    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      rawApiKey,
      environment: row.environment,
      scopes: row.scopes,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  }

  public async validateApiKey(rawKey: string, requiredScope?: Permission): Promise<ValidatedApiKeyResult> {
    if (!rawKey || (!rawKey.startsWith('ak_live_') && !rawKey.startsWith('ak_test_'))) {
      throw new UnauthorizedError('Invalid or missing API key format');
    }

    const keyPrefix = rawKey.substring(0, 16);
    const keyHash = this.hashKey(rawKey);

    const query = `
      SELECT id, agent_id as "agentId", name, key_hash as "keyHash",
             environment, scopes, rate_limit_tier as "rateLimitTier",
             status, expires_at as "expiresAt"
      FROM api_keys
      WHERE key_prefix = $1
    `;

    const result = await this.db.query<{
      id: string;
      agentId: string;
      name: string;
      keyHash: string;
      environment: ApiKeyEnvironment;
      scopes: Permission[];
      rateLimitTier: string;
      status: ApiKeyStatus;
      expiresAt: Date | null;
    }>(query, [keyPrefix]);

    if (result.rows.length === 0) {
      throw new UnauthorizedError('API key not found or invalid');
    }

    const row = result.rows[0];

    // Constant-time hash comparison
    if (
      keyHash.length !== row.keyHash.length ||
      !crypto.timingSafeEqual(Buffer.from(keyHash), Buffer.from(row.keyHash))
    ) {
      throw new UnauthorizedError('Invalid API key credentials');
    }

    if (row.status !== ApiKeyStatus.ACTIVE) {
      throw new ForbiddenError(`API key is ${row.status.toLowerCase()}`);
    }

    if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
      throw new ForbiddenError('API key has expired');
    }

    if (requiredScope && !row.scopes.includes(requiredScope)) {
      throw new ForbiddenError(`API key lacks required permission scope: ${requiredScope}`);
    }

    // Update last_used_at asynchronously
    this.db.query('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [row.id]).catch(() => {});

    return {
      id: row.id,
      agentId: row.agentId,
      name: row.name,
      environment: row.environment,
      scopes: row.scopes,
      rateLimitTier: row.rateLimitTier,
    };
  }

  public async revokeApiKey(keyId: string, agentId: string): Promise<void> {
    await this.db.query(
      "UPDATE api_keys SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND agent_id = $2",
      [keyId, agentId],
    );
  }

  public async listAgentApiKeys(agentId: string): Promise<Array<{
    id: string;
    name: string;
    keyPrefix: string;
    environment: ApiKeyEnvironment;
    scopes: Permission[];
    status: ApiKeyStatus;
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
  }>> {
    const query = `
      SELECT id, name, key_prefix as "keyPrefix", environment, scopes,
             status, last_used_at as "lastUsedAt", expires_at as "expiresAt",
             created_at as "createdAt"
      FROM api_keys
      WHERE agent_id = $1
      ORDER BY created_at DESC
    `;
    const result = await this.db.query(query, [agentId]);
    return result.rows;
  }

  public hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }
}
