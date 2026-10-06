import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
vi.mock('os', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:os')>(),
  homedir: () => {
    if (!process.env.SHIFTMINT_DATA_DIR) throw new Error('Database test profile not isolated');
    return process.env.SHIFTMINT_DATA_DIR;
  },
}));
import { closeDatabase, getDataDirectory, getPrismaClient, initializeDatabase } from '../../electron/backend/database';

const testRoot = path.resolve('.tmp-tests');
let directory: string;
let previousDirectory: string | undefined;
let previousDatabase: string | undefined;

beforeEach(() => {
  fs.mkdirSync(testRoot, { recursive: true });
  directory = fs.mkdtempSync(path.join(testRoot, 'database-'));
  previousDirectory = process.env.SHIFTMINT_DATA_DIR;
  previousDatabase = process.env.DATABASE_URL;
  process.env.SHIFTMINT_DATA_DIR = directory;
  delete process.env.DATABASE_URL;
});

afterEach(async () => {
  await closeDatabase();
  if (previousDirectory === undefined) delete process.env.SHIFTMINT_DATA_DIR;
  else process.env.SHIFTMINT_DATA_DIR = previousDirectory;
  if (previousDatabase === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabase;
  if (!directory.startsWith(testRoot + path.sep)) throw new Error('Test cleanup escaped its root');
  // Retry temporary Windows filesystem locks; exhaustion still fails cleanup.
  fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('canonical database initialization', () => {
  it('uses an explicit data directory rather than the user profile', () => {
    expect(getDataDirectory()).toBe(directory);
  });

  it('creates every current Prisma model and preserves data on a second launch', async () => {
    await initializeDatabase();
    const prisma = getPrismaClient();
    await expect(prisma.refreshToken.count()).resolves.toBe(0);
    await expect(prisma.tipAuditLog.count()).resolves.toBe(0);
    await expect(prisma.tipPoolDistribution.count()).resolves.toBe(0);
    await expect(prisma.complianceCalculation.count()).resolves.toBe(0);
    await expect(prisma.tipImportLog.count()).resolves.toBe(0);
    const business = await prisma.business.create({ data: { name: 'Isolated test', location: 'Test', posSystem: 'square', usageIntent: 'audit' } });
    const shift = await prisma.shift.create({ data: { businessId: business.id, shiftDate: '2026-10-05', startTime: new Date('2026-10-05T12:00:00Z'), position: 'server', hourlyRate: 20, regularWage: 40, totalWage: 40 } });
    await closeDatabase();
    await initializeDatabase();
    await expect(getPrismaClient().business.findUnique({ where: { id: business.id } })).resolves.toMatchObject({ name: 'Isolated test', location: 'Test' });
    await expect(getPrismaClient().shift.findUnique({ where: { id: shift.id } })).resolves.toMatchObject({ hourlyRate: 20, totalWage: 40 });
  }, 60000);

  it('refuses an orphaned workspace without deleting its records', async () => {
    await initializeDatabase();
    const prisma = getPrismaClient();
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
    await prisma.$executeRawUnsafe("INSERT INTO employees(id,businessId,employeeNumber,firstName,lastName,email,hourlyRate,role,startDate,updatedAt) VALUES('orphan-fixture','missing-business','orphan-1','Synthetic','Orphan','orphan@example.invalid',20,'server',1790812800000,1791158400000)");
    await closeDatabase();
    await expect(initializeDatabase()).rejects.toThrow('Database integrity verification failed');
    expect(await getPrismaClient().employee.count({ where: { id: 'orphan-fixture' } })).toBe(1);
  }, 60000);
});
