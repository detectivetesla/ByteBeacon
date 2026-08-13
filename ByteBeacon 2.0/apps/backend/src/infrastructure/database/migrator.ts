import pg from 'pg';
import { logger } from '../../core/logging/logger.js';

export interface MigrationFile {
  version: string;
  name: string;
  upSql: string;
  downSql?: string;
}

export interface MigrationStatus {
  version: string;
  name: string;
  applied: boolean;
  appliedAt?: Date;
}

export class DatabaseMigrator {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  public async ensureMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await this.pool.query(query);
  }

  public async getAppliedMigrations(): Promise<Map<string, Date>> {
    await this.ensureMigrationsTable();
    const result = await this.pool.query<{ version: string; applied_at: Date }>(
      'SELECT version, applied_at FROM schema_migrations ORDER BY version ASC',
    );
    const map = new Map<string, Date>();
    for (const row of result.rows) {
      map.set(row.version, row.applied_at);
    }
    return map;
  }

  public async applyMigration(migration: MigrationFile): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      logger.info(`Applying migration [${migration.version}]: ${migration.name}`);
      await client.query(migration.upSql);
      await client.query(
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
        [migration.version, migration.name],
      );
      await client.query('COMMIT');
      logger.info(`Successfully applied migration [${migration.version}]`);
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ err, version: migration.version }, `Failed to apply migration [${migration.version}]`);
      throw err;
    } finally {
      client.release();
    }
  }

  public async rollbackMigration(migration: MigrationFile): Promise<void> {
    if (!migration.downSql) {
      throw new Error(`Migration [${migration.version}] does not provide a rollback script.`);
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      logger.info(`Rolling back migration [${migration.version}]: ${migration.name}`);
      await client.query(migration.downSql);
      await client.query('DELETE FROM schema_migrations WHERE version = $1', [migration.version]);
      await client.query('COMMIT');
      logger.info(`Successfully rolled back migration [${migration.version}]`);
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ err, version: migration.version }, `Failed to rollback migration [${migration.version}]`);
      throw err;
    } finally {
      client.release();
    }
  }

  public async getStatus(availableMigrations: MigrationFile[]): Promise<MigrationStatus[]> {
    const applied = await this.getAppliedMigrations();
    return availableMigrations.map((m) => ({
      version: m.version,
      name: m.name,
      applied: applied.has(m.version),
      appliedAt: applied.get(m.version),
    }));
  }
}
