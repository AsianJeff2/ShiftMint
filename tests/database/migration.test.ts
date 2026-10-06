import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

vi.mock('os', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:os')>(),
  homedir: () => {
    if (!process.env.SHIFTMINT_DATA_DIR) throw new Error('Database test profile not isolated');
    return process.env.SHIFTMINT_DATA_DIR;
  },
}));
import { closeDatabase, getPrismaClient, initializeDatabase } from '../../electron/backend/database';

const testRoot = path.resolve('.tmp-tests');
const sourceSchema = path.resolve('prisma/schema.prisma');
const cli = path.join(path.dirname(require.resolve('prisma/package.json')), 'build/index.js');
let directory: string;
let previousDirectory: string | undefined;
let previousDatabase: string | undefined;

beforeEach(() => {
  fs.mkdirSync(testRoot, { recursive: true });
  directory = fs.mkdtempSync(path.join(testRoot, 'migration-'));
  previousDirectory = process.env.SHIFTMINT_DATA_DIR;
  previousDatabase = process.env.DATABASE_URL;
  process.env.SHIFTMINT_DATA_DIR = directory;
  process.env.DATABASE_URL = `file:${path.join(directory, 'shiftmint.db').replace(/\\/g, '/')}`;
});

afterEach(async () => {
  await closeDatabase();
  if (previousDirectory === undefined) delete process.env.SHIFTMINT_DATA_DIR; else process.env.SHIFTMINT_DATA_DIR = previousDirectory;
  if (previousDatabase === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDatabase;
  if (!directory.startsWith(testRoot + path.sep)) throw new Error('Test cleanup escaped its root');
  fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

async function initializeHistoricalFixture(): Promise<void> {
  const schemaDirectory = path.join(directory, 'historical-schema');
  fs.mkdirSync(path.join(schemaDirectory, 'migrations'), { recursive: true });
  fs.copyFileSync(sourceSchema, path.join(schemaDirectory, 'schema.prisma'));
  const sourceMigrations = path.join(path.dirname(sourceSchema), 'migrations');
  fs.copyFileSync(path.join(sourceMigrations, 'migration_lock.toml'), path.join(schemaDirectory, 'migrations/migration_lock.toml'));
  for (const migration of fs.readdirSync(sourceMigrations).filter(name => name.startsWith('202508'))) {
    const destination = path.join(schemaDirectory, 'migrations', migration);
    fs.mkdirSync(destination);
    fs.copyFileSync(path.join(sourceMigrations, migration, 'migration.sql'), path.join(destination, 'migration.sql'));
  }
  // Match production initialization: the Windows schema engine expects the file.
  fs.closeSync(fs.openSync(path.join(directory, 'shiftmint.db'), 'wx'));
  execFileSync(process.execPath, [cli, 'migrate', 'deploy', '--schema', path.join(schemaDirectory, 'schema.prisma')], { cwd: schemaDirectory, env: process.env, windowsHide: true, stdio: 'pipe' });
  const client = getPrismaClient();
  await client.$executeRawUnsafe("INSERT INTO businesses(id,name,updatedAt) VALUES('business-fixture','Historical fixture',1791158400000)");
  await client.$executeRawUnsafe("INSERT INTO shifts(id,businessId,shiftDate,startTime,totalSales,totalTips,updatedAt) VALUES('shift-fixture','business-fixture','2026-10-05',1791201600000,200,40,1791158400000)");
  await client.$executeRawUnsafe("INSERT INTO employees(id,businessId,employeeNumber,firstName,lastName,email,hourlyRate,role,startDate,updatedAt) VALUES('employee-fixture','business-fixture','fixture-1','Synthetic','Employee','fixture@example.invalid',20,'server',1790812800000,1791158400000)");
  await client.$executeRawUnsafe("INSERT INTO payroll_periods(id,businessId,startDate,endDate,updatedAt) VALUES('period-fixture','business-fixture',1790812800000,1791331200000,1791158400000)");
  await client.$executeRawUnsafe("INSERT INTO payroll_entries(id,payrollPeriodId,employeeId,regularHours,regularPay,grossPay,netPay,hoursWorked,updatedAt) VALUES('payroll-fixture','period-fixture','employee-fixture',4,80,80,70,4,1791158400000)");
}

async function addHistoricalRuntimeColumns(): Promise<void> {
  const client = getPrismaClient();
  for (const [column, definition] of [
    ['position', 'TEXT'], ['employeeType', 'TEXT'], ['stationNumber', 'TEXT'],
    ['hourlyRate', 'REAL DEFAULT 0'], ['regularWage', 'REAL DEFAULT 0'],
    ['overtimeWage', 'REAL DEFAULT 0'], ['totalWage', 'REAL DEFAULT 0'],
  ]) await client.$executeRawUnsafe(`ALTER TABLE shifts ADD COLUMN ${column} ${definition}`);
  await client.$executeRawUnsafe("UPDATE shifts SET position='server', employeeType='regular', stationNumber='A1', hourlyRate=20, regularWage=80, overtimeWage=30, totalWage=110");
}

describe('data-preserving canonical migration', () => {
  it('upgrades the recorded 2025 schema while retaining shift and payroll values', async () => {
    await initializeHistoricalFixture();
    await closeDatabase();
    await initializeDatabase();
    const client = getPrismaClient();
    await expect(client.shift.findUnique({ where: { id: 'shift-fixture' } })).resolves.toMatchObject({ totalSales: 200, totalTips: 40, hourlyRate: 0 });
    await expect(client.payrollEntry.findUnique({ where: { id: 'payroll-fixture' } })).resolves.toMatchObject({ regularHours: 4, regularPay: 80, grossPay: 80, netPay: 70, hoursWorked: 4 });
    await expect(client.refreshToken.count()).resolves.toBe(0);
  }, 60000);

  it('refuses unrecorded runtime additions before changing their schema or values', async () => {
    await initializeHistoricalFixture();
    await addHistoricalRuntimeColumns();
    await expect(initializeDatabase()).rejects.toThrow('Legacy runtime schema changes');
    const client = getPrismaClient();
    const shifts = await client.$queryRawUnsafe<Array<Record<string, unknown>>>('SELECT position, employeeType, stationNumber, hourlyRate, regularWage, overtimeWage, totalWage FROM shifts');
    expect(shifts[0]).toMatchObject({ position: 'server', employeeType: 'regular', stationNumber: 'A1', hourlyRate: 20, regularWage: 80, overtimeWage: 30, totalWage: 110 });
    const tables = await client.$queryRawUnsafe<Array<{ name: string }>>("SELECT name FROM sqlite_master WHERE type='table'");
    expect(tables.some(table => table.name === 'refresh_tokens')).toBe(false);
    expect(tables.some(table => table.name.startsWith('new_'))).toBe(false);
  }, 60000);

  it('keeps drifted wage data intact even when raw Prisma deploy bypasses the runtime guard', async () => {
    await initializeHistoricalFixture();
    await addHistoricalRuntimeColumns();
    await closeDatabase();
    expect(() => execFileSync(process.execPath, [cli, 'migrate', 'deploy', '--schema', sourceSchema], { cwd: path.dirname(sourceSchema), env: process.env, windowsHide: true, stdio: 'pipe' })).toThrow();
    const values = await getPrismaClient().$queryRawUnsafe<Array<{ position: string; totalWage: number }>>('SELECT position, totalWage FROM shifts');
    expect(values[0]).toMatchObject({ position: 'server', totalWage: 110 });
  }, 60000);
});
