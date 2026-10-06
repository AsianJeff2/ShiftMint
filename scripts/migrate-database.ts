import { closeDatabase, initializeDatabase } from '../electron/backend/database';

async function migrate(): Promise<void> {
  try {
    await initializeDatabase();
    console.log('ShiftMint database migration completed.');
  } finally {
    await closeDatabase();
  }
}

migrate().catch(error => {
  console.error(error instanceof Error ? error.message : 'Database migration failed');
  process.exitCode = 1;
});
