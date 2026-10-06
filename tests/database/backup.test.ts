import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';

vi.mock('os', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:os')>(),
  homedir: () => {
    if (!process.env.SHIFTMINT_DATA_DIR) throw new Error('Database test profile not isolated');
    return process.env.SHIFTMINT_DATA_DIR;
  },
}));
import {
  closeDatabase, createDatabaseBackup, deleteDatabaseBackup, getBackupsDirectory,
  getDatabasePath, getPrismaClient, initializeDatabase, isDatabaseMaintenanceInProgress,
  registerDatabaseMaintenanceDrain, restoreDatabaseFromBackup,
} from '../../electron/backend/database';
import { decrypt, encrypt } from '../../lib/security/encryption';

const testRoot = path.resolve('.tmp-tests');
let directory: string;
let previousEnvironment: Record<string, string | undefined>;
let businessId: string;

beforeEach(async () => {
  fs.mkdirSync(testRoot, { recursive: true });
  directory = fs.mkdtempSync(path.join(testRoot, 'backup-'));
  previousEnvironment = { SHIFTMINT_DATA_DIR: process.env.SHIFTMINT_DATA_DIR, DATABASE_URL: process.env.DATABASE_URL, ENCRYPTION_KEY: process.env.ENCRYPTION_KEY, SHIFTMINT_RUNTIME: process.env.SHIFTMINT_RUNTIME };
  process.env.SHIFTMINT_DATA_DIR = directory;
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  delete process.env.DATABASE_URL;
  registerDatabaseMaintenanceDrain(async () => {});
  await initializeDatabase();
  const business = await getPrismaClient().business.create({ data: { name: 'Backup fixture' } });
  businessId = business.id;
}, 60000);

afterEach(async () => {
  vi.restoreAllMocks();
  registerDatabaseMaintenanceDrain(async () => {});
  await closeDatabase();
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  if (!directory.startsWith(testRoot + path.sep)) throw new Error('Test cleanup escaped its root');
  fs.rmSync(directory, { recursive: true, force: true });
});

async function currentName(): Promise<string | undefined> {
  return (await getPrismaClient().business.findUnique({ where: { id: businessId } }))?.name;
}

describe('staged database backup restore', () => {
  it('restores a complete snapshot and keeps encrypted values readable', async () => {
    const client = getPrismaClient();
    await client.business.update({ where: { id: businessId }, data: { ein: encrypt('synthetic-ein') } });
    const backup = await createDatabaseBackup('valid-backup.db');
    expect((await client.appSetting.findUnique({ where: { key: 'last_backup' } }))?.value).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await client.business.update({ where: { id: businessId }, data: { name: 'After snapshot' } });
    const drain = vi.fn(async () => {
      expect(isDatabaseMaintenanceInProgress()).toBe(true);
      expect(() => getPrismaClient()).toThrow('maintenance');
    });
    registerDatabaseMaintenanceDrain(drain);
    await restoreDatabaseFromBackup(backup);
    expect(drain).toHaveBeenCalledOnce();
    expect(await currentName()).toBe('Backup fixture');
    expect(decrypt((await client.business.findUnique({ where: { id: businessId } }))?.ein)).toBe('synthetic-ein');
    expect(isDatabaseMaintenanceInProgress()).toBe(false);
  });

  it('rejects a truncated SQLite-looking file before changing current records', async () => {
    const backup = path.join(getBackupsDirectory(), 'malformed.db');
    fs.writeFileSync(backup, Buffer.from('SQLite format 3\u0000'));
    await expect(restoreDatabaseFromBackup(backup)).rejects.toThrow();
    expect(await currentName()).toBe('Backup fixture');
    expect(isDatabaseMaintenanceInProgress()).toBe(false);
  });

  it('checks models beyond the old app-setting and dashboard health checks', async () => {
    const backup = await createDatabaseBackup('wrong-schema.db');
    const candidate = new PrismaClient({ datasources: { db: { url: `file:${backup.replace(/\\/g, '/')}` } } });
    try { await candidate.$executeRawUnsafe('ALTER TABLE refresh_tokens RENAME COLUMN tokenId TO incompatibleTokenId'); }
    finally { await candidate.$disconnect(); }
    await expect(restoreDatabaseFromBackup(backup)).rejects.toThrow('RefreshToken.tokenId');
    expect(await currentName()).toBe('Backup fixture');
  });

  it('rejects rows SQLite accepts but Prisma cannot decode', async () => {
    const backup = await createDatabaseBackup('wrong-data.db');
    const candidate = new PrismaClient({ datasources: { db: { url: `file:${backup.replace(/\\/g, '/')}` } } });
    try { await candidate.$executeRawUnsafe("UPDATE businesses SET updatedAt = 'invalid-date'"); }
    finally { await candidate.$disconnect(); }
    await expect(restoreDatabaseFromBackup(backup)).rejects.toThrow('records incompatible with Business');
    expect(await currentName()).toBe('Backup fixture');
  });

  it('rejects a valid multi-business snapshot before replacing a hosted workspace', async () => {
    const client = getPrismaClient();
    const second = await client.business.create({ data: { name: 'Second synthetic business' } });
    const backup = await createDatabaseBackup('multi-business.db');
    await client.business.delete({ where: { id: second.id } });
    process.env.SHIFTMINT_RUNTIME = 'web';
    await expect(restoreDatabaseFromBackup(backup)).rejects.toThrow('one business per workspace');
    await expect(client.business.count()).resolves.toBe(1);
    expect(await currentName()).toBe('Backup fixture');
  });

  it('rejects records encrypted for another key and retains the current snapshot', async () => {
    const client = getPrismaClient();
    await client.business.update({ where: { id: businessId }, data: { ein: encrypt('old-fixture') } });
    const backup = await createDatabaseBackup('other-key.db');
    process.env.ENCRYPTION_KEY = 'b'.repeat(64);
    await client.business.update({ where: { id: businessId }, data: { name: 'Current workspace', ein: encrypt('current-fixture') } });
    await expect(restoreDatabaseFromBackup(backup)).rejects.toThrow('encryption key');
    expect(await currentName()).toBe('Current workspace');
    expect(decrypt((await client.business.findUnique({ where: { id: businessId } }))?.ein)).toBe('current-fixture');
  });

  it('rejects a wrong-key backup whose only ciphertext is a POS connection', async () => {
    const client = getPrismaClient();
    const key = `pos.connection.v1:${businessId}:square`;
    const value = encrypt(JSON.stringify({ credentials: { provider: 'square' }, connection: { provider: 'square', locations: [] } }))!;
    await client.appSetting.create({ data: { key, value } });
    const backup = await createDatabaseBackup('pos-other-key.db');
    await client.appSetting.delete({ where: { key } });
    process.env.ENCRYPTION_KEY = 'b'.repeat(64);
    await client.business.update({ where: { id: businessId }, data: { name: 'Current POS workspace' } });
    await expect(restoreDatabaseFromBackup(backup)).rejects.toThrow('Backup POS credentials');
    expect(await currentName()).toBe('Current POS workspace');
    await expect(client.appSetting.findUnique({ where: { key } })).resolves.toBeNull();
  });

  it('rolls back automatically when reconnect fails after the atomic replacement', async () => {
    const client = getPrismaClient();
    const backup = await createDatabaseBackup('rollback.db');
    await client.business.update({ where: { id: businessId }, data: { name: 'Preserve this current record' } });
    const connect = client.$connect.bind(client);
    vi.spyOn(client, '$connect').mockRejectedValueOnce(new Error('Simulated reconnect failure')).mockImplementation(connect);
    await expect(restoreDatabaseFromBackup(backup)).rejects.toThrow('Simulated reconnect failure');
    expect(await currentName()).toBe('Preserve this current record');
    expect(isDatabaseMaintenanceInProgress()).toBe(false);
    expect(fs.readdirSync(directory).some(name => name.startsWith('.shiftmint-restore-'))).toBe(false);
  });

  it('fails safely when active requests cannot drain', async () => {
    const backup = await createDatabaseBackup('drain.db');
    registerDatabaseMaintenanceDrain(async () => { throw new Error('Requests did not drain'); });
    await expect(restoreDatabaseFromBackup(backup)).rejects.toThrow('Requests did not drain');
    expect(await currentName()).toBe('Backup fixture');
    expect(isDatabaseMaintenanceInProgress()).toBe(false);
  });

  it('rejects a redirected backup directory before deleting any target file', () => {
    const backups = getBackupsDirectory();
    const redirected = path.join(directory, 'redirected');
    fs.mkdirSync(redirected);
    const protectedFile = path.join(redirected, 'keep.db');
    fs.writeFileSync(protectedFile, 'Synthetic fixture');
    fs.rmdirSync(backups);
    fs.symlinkSync(redirected, backups, process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => deleteDatabaseBackup(path.join(backups, 'keep.db'))).toThrow('without links');
    expect(fs.readFileSync(protectedFile, 'utf8')).toBe('Synthetic fixture');
  });

  it('separates SQLite URL options and standard file URLs from the filename', () => {
    const databasePath = path.join(directory, 'configured.db');
    process.env.DATABASE_URL = `${pathToFileURL(databasePath).href}?connection_limit=1`;
    expect(getDatabasePath()).toBe(databasePath);
    process.env.DATABASE_URL = `file:${databasePath}?connection_limit=1`;
    expect(getDatabasePath()).toBe(databasePath);
  });
});
