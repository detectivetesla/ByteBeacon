import type pg from 'pg';
import { logger } from '../logging/logger.js';

export interface AuditEventParams {
  correlationId: string;
  actorId?: string;
  actorType: 'CUSTOMER' | 'ADMIN' | 'AGENT' | 'SYSTEM' | 'PROVIDER';
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  private readonly db: pg.Pool;

  constructor(db: pg.Pool) {
    this.db = db;
  }

  public async logEvent(params: AuditEventParams): Promise<void> {
    const query = `
      INSERT INTO audit_logs (correlation_id, actor_id, actor_type, action, resource_type, resource_id, metadata, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    try {
      await this.db.query(query, [
        params.correlationId,
        params.actorId || null,
        params.actorType,
        params.action,
        params.resourceType || null,
        params.resourceId || null,
        JSON.stringify(params.metadata || {}),
        params.ipAddress || null,
        params.userAgent || null,
      ]);

      logger.info(
        {
          correlationId: params.correlationId,
          actorId: params.actorId,
          actorType: params.actorType,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
        },
        `[AUDIT] ${params.action}`,
      );
    } catch (error) {
      logger.error({ error, event: params }, 'Failed to persist audit log event');
    }
  }
}
