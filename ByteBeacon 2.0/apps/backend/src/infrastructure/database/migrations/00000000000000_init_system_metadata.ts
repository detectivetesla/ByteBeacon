import { MigrationFile } from '../migrator.js';

export const initSystemMetadataMigration: MigrationFile = {
  version: '20260813000000',
  name: 'init_system_metadata',
  upSql: `
    CREATE TABLE IF NOT EXISTS system_metadata (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO system_metadata (key, value)
    VALUES ('schema_version', '2.0.0-phase1')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
  `,
  downSql: `
    DROP TABLE IF EXISTS system_metadata;
  `,
};
