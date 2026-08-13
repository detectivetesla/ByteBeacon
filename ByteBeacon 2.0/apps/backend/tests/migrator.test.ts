import { describe, it, expect, vi } from 'vitest';
import { DatabaseMigrator, MigrationFile } from '../src/infrastructure/database/migrator.js';
import type pg from 'pg';

describe('Database Migration Framework', () => {
  it('should correctly compute pending and applied migration statuses', async () => {
    const mockPool = {
      query: vi.fn().mockImplementation((query: string) => {
        if (query.includes('CREATE TABLE')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('SELECT version')) {
          return Promise.resolve({
            rows: [{ version: '20260813000000', applied_at: new Date() }],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
    } as unknown as pg.Pool;

    const migrator = new DatabaseMigrator(mockPool);

    const testMigrations: MigrationFile[] = [
      {
        version: '20260813000000',
        name: 'init_system_metadata',
        upSql: 'SELECT 1;',
      },
      {
        version: '20260813000001',
        name: 'future_migration',
        upSql: 'SELECT 2;',
      },
    ];

    const status = await migrator.getStatus(testMigrations);
    expect(status).toHaveLength(2);
    expect(status[0].applied).toBe(true);
    expect(status[0].version).toBe('20260813000000');
    expect(status[1].applied).toBe(false);
    expect(status[1].version).toBe('20260813000001');
  });
});
