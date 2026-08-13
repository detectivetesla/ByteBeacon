import { getDatabasePool, closeDatabasePool } from './pool.js';
import { DatabaseMigrator } from './migrator.js';
import { migration00000000000000 } from './migrations/00000000000000_init_system_metadata.js';
import { migration00000000000001 } from './migrations/00000000000001_create_security_auth_schema.js';
import { migration00000000000002 } from './migrations/00000000000002_create_core_commerce_schema.js';
import { logger } from '../../core/logging/logger.js';

const allMigrations = [
  migration00000000000000,
  migration00000000000001,
  migration00000000000002,
];

async function main() {
  const pool = getDatabasePool();
  const migrator = new DatabaseMigrator(pool);

  try {
    const command = process.argv[2] || 'up';

    if (command === 'status') {
      const statuses = await migrator.getStatus(allMigrations);
      logger.info({ statuses }, 'Migration status:');
    } else if (command === 'up') {
      const applied = await migrator.runPendingMigrations(allMigrations);
      logger.info({ count: applied.length, applied }, 'Applied migrations successfully.');
    } else {
      logger.error(`Unknown migration command: ${command}`);
      process.exit(1);
    }
  } catch (error) {
    logger.error({ error }, 'Migration CLI failed');
    process.exit(1);
  } finally {
    await closeDatabasePool();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
