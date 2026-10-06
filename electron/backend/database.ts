import { logger } from '../../lib/infrastructure/Logger';
import { Prisma, PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { getMigrationSchemaPath, runDatabaseMigrations } from './migrations';
import { checkDatabaseHealth, verifyDatabaseIntegrity } from './database-health';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { decrypt, isEncrypted } from '../../lib/security/encryption';

let prisma: PrismaClient;
let maintenanceInProgress = false;
let drainDatabaseRequests: () => Promise<void> = async () => {};

export function isDatabaseMaintenanceInProgress(): boolean { return maintenanceInProgress; }
export function registerDatabaseMaintenanceDrain(drain: () => Promise<void>): void { drainDatabaseRequests = drain; }

function normalizedDatabaseUrl(): string {
  const query = process.env.DATABASE_URL?.split('?')[1];
  return `file:${getDatabasePath().replace(/\\/g, '/')}${query ? `?${query}` : ''}`;
}

export function getPrismaClient(): PrismaClient {
  if (maintenanceInProgress) throw new Error('Database maintenance is in progress');
  if (!prisma) {
    process.env.DATABASE_URL = normalizedDatabaseUrl();
    prisma = new PrismaClient();
  }
  return prisma;
}

export function getDataDirectory(): string {
  if (process.env.SHIFTMINT_DATA_DIR) {
    if (!path.isAbsolute(process.env.SHIFTMINT_DATA_DIR)) throw new Error('SHIFTMINT_DATA_DIR must be an absolute path');
    return path.resolve(process.env.SHIFTMINT_DATA_DIR);
  }
  let dataDir: string;
  
  switch (os.platform()) {
    case 'darwin': // macOS
      dataDir = path.join(os.homedir(), 'Library', 'Application Support', 'ShiftMint');
      break;
    case 'win32': // Windows
      dataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'ShiftMint');
      break;
    default: // Linux and others
      dataDir = path.join(os.homedir(), '.shiftmint');
  }
  
  return dataDir;
}

export async function initializeDatabase(): Promise<void> {
  try {
    logger.info('Initializing database...');
    
    // Create data directory if it doesn't exist
    const dataDir = getDataDirectory();
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logger.info('Created data directory', { directory: dataDir });
    }
    
    // Create logs directory
    const logsDir = path.join(dataDir, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      logger.info('Created logs directory', { directory: logsDir });
    }
    
    // Set database URL
    const dbPath = getDatabasePath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    if (!fs.existsSync(dbPath)) fs.closeSync(fs.openSync(dbPath, 'wx'));
    process.env.DATABASE_URL = normalizedDatabaseUrl();
    
    logger.info('Database path', { path: dbPath });
    
    // Initialize Prisma client
    prisma = getPrismaClient();
    
    // Test the connection
    await prisma.$connect();
    logger.info('Database connected successfully');
    
    // Run production-ready database migrations
    const migrationResult = await runDatabaseMigrations(prisma, () => createBackupSnapshot(prisma, `shiftmint-before-upgrade-${Date.now()}-${randomUUID()}.db`));
    
    if (!migrationResult.success) {
      throw new Error(`Database migration failed: ${migrationResult.error}`);
    }
    
    if (migrationResult.isFirstTime) {
      logger.info('🎉 Fresh installation completed - database ready for first use');
    } else {
      logger.info('✅ Existing database updated and ready');
    }
    
    // Run health checks
    logger.info('🔍 Running database health checks...');
    const healthCheck = await checkDatabaseHealth(prisma);
    
    if (healthCheck.healthy) {
      logger.info('✅ Database health check passed');
      logger.info(`   - Version: ${healthCheck.version}`);
      logger.info(`   - Tables accessible: ${healthCheck.tablesCount}`);
      if (healthCheck.lastBackup && healthCheck.lastBackup !== 'never') {
        logger.info(`   - Last backup: ${healthCheck.lastBackup}`);
      }
    } else {
      logger.warn('⚠️  Database health check found issues:');
      healthCheck.issues.forEach(issue => logger.warn(`   - ${issue}`));
      
      if (healthCheck.recommendations.length > 0) {
        logger.info('💡 Recommendations:');
        healthCheck.recommendations.forEach(rec => logger.info(`   - ${rec}`));
      }
    }
    
    // Verify database integrity
    const integrityCheck = await verifyDatabaseIntegrity(prisma);
    if (!integrityCheck.success) {
      logger.error('❌ Database integrity check failed:');
      integrityCheck.errors.forEach(error => logger.error(`   - ${error}`));
      throw new Error('Database integrity verification failed');
    }
    
    logger.info('✅ Database initialization and verification completed');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}



export async function closeDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Database connection closed');
    prisma = undefined as unknown as PrismaClient;
  }
}

/**
 * Get the current database file path
 */
export function getDatabasePath(): string {
  if (process.env.DATABASE_URL) {
    if (!process.env.DATABASE_URL.startsWith('file:')) throw new Error('This distribution requires a SQLite file database');
    if (process.env.DATABASE_URL.startsWith('file://')) return fileURLToPath(new URL(process.env.DATABASE_URL));
    return path.resolve(process.env.DATABASE_URL.slice(5).split('?')[0]);
  }
  const dataDir = getDataDirectory();
  return path.join(dataDir, 'shiftmint.db');
}

/**
 * Get the backups directory path
 */
export function getBackupsDirectory(): string {
  const dataDir = getDataDirectory();
  const backupsDir = path.join(dataDir, 'backups');
  
  // Create backups directory if it doesn't exist
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  const stats = fs.lstatSync(backupsDir);
  if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error('Backup directory must be a directory inside the workspace, without links');
  
  return backupsDir;
}

/**
 * Create a backup of the current database
 */
export async function createDatabaseBackup(customName?: string): Promise<string> {
  const client = getPrismaClient();
  const backupPath = await createBackupSnapshot(client, customName);
  const value = new Date().toISOString();
  await client.appSetting.upsert({ where: { key: 'last_backup' }, create: { key: 'last_backup', value }, update: { value } });
  return backupPath;
}

async function createBackupSnapshot(client: PrismaClient, customName?: string): Promise<string> {
  try {
    const dbPath = getDatabasePath();
    const backupsDir = getBackupsDirectory();
    
    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      throw new Error('Database file not found');
    }
    
    // Generate backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = customName || `shiftmint-backup-${timestamp}-${randomUUID()}.db`;
    if (path.basename(backupName) !== backupName || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.db$/.test(backupName)) throw new Error('Backup name must be a .db filename');
    const backupPath = resolveBackupPath(path.join(backupsDir, backupName));
    
    await client.$executeRawUnsafe('VACUUM INTO ?', backupPath);
    
    logger.info('Database backup created', { path: backupPath });
    return backupPath;
  } catch (error) {
    logger.error('Failed to create database backup:', error);
    throw error;
  }
}

/**
 * Restore database from a backup file
 */
export async function restoreDatabaseFromBackup(backupPath: string): Promise<void> {
  if (maintenanceInProgress) throw new Error('Database maintenance is already in progress');
  backupPath = resolveBackupPath(backupPath);
  if (!fs.existsSync(backupPath)) throw new Error('Backup file not found');
  const dbPath = getDatabasePath();
  const client = getPrismaClient();
  let stageDirectory: string | undefined;
  let recoveryPath: string | undefined;
  let disconnected = false;
  let replaced = false;
  maintenanceInProgress = true;
  try {
    await drainDatabaseRequests();
    stageDirectory = fs.mkdtempSync(path.join(path.dirname(dbPath), '.shiftmint-restore-'));
    const stagedPath = path.join(stageDirectory, 'candidate.db');
    fs.copyFileSync(backupPath, stagedPath, fs.constants.COPYFILE_EXCL);
    await validateSQLiteFile(stagedPath);
    const candidate = new PrismaClient({ datasources: { db: { url: `file:${stagedPath.replace(/\\/g, '/')}` } } });
    try { await validateCurrentDatabase(candidate); } finally { await candidate.$disconnect(); }

    recoveryPath = await createBackupSnapshot(client);
    await client.$disconnect();
    disconnected = true;
    removeSQLiteSidecars(dbPath);
    fs.renameSync(stagedPath, dbPath);
    replaced = true;
    await client.$connect();
    await validateCurrentDatabase(client);
    logger.info('Database restored successfully from:', backupPath);
  } catch (error) {
    if (disconnected) {
      try {
        await client.$disconnect();
        if (replaced && recoveryPath && stageDirectory) {
          const rollbackPath = path.join(stageDirectory, 'rollback.db');
          fs.copyFileSync(recoveryPath, rollbackPath, fs.constants.COPYFILE_EXCL);
          removeSQLiteSidecars(dbPath);
          fs.renameSync(rollbackPath, dbPath);
        }
        await client.$connect();
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], `Database restore failed and automatic recovery failed. Preserve the recovery backup at ${recoveryPath ?? 'the workspace backup directory'} for offline recovery.`);
      }
    }
    logger.error('Failed to restore database:', error);
    throw error;
  } finally {
    maintenanceInProgress = false;
    if (stageDirectory) {
      try {
        // Remove only known files inside the directory created by this operation.
        for (const name of ['candidate.db', 'rollback.db']) {
          const candidate = path.join(stageDirectory, name);
          removeSQLiteSidecars(candidate);
          if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
        }
        fs.rmdirSync(stageDirectory);
      } catch {
        logger.warn('Database restore staging cleanup failed; inspect the workspace restore staging directory');
      }
    }
  }
}

function removeSQLiteSidecars(databasePath: string): void {
  for (const suffix of ['-wal', '-shm', '-journal']) {
    const sidecar = databasePath + suffix;
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
  }
}

function quoteIdentifier(identifier: string): string { return `"${identifier.replace(/"/g, '""')}"`; }

/** Check every generated model and known migration before replacing the workspace. */
async function validateCurrentDatabase(client: PrismaClient): Promise<void> {
  if (process.env.SHIFTMINT_RUNTIME === 'web' && await client.business.count() > 1) throw new Error('Hosted restore supports one business per workspace; split a multi-business backup offline before restoring');
  const integrity = await client.$queryRawUnsafe<Array<{ integrity_check: string }>>('PRAGMA integrity_check');
  if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') throw new Error('Backup failed SQLite integrity validation');
  const foreignKeys = await client.$queryRawUnsafe<unknown[]>('PRAGMA foreign_key_check');
  if (foreignKeys.length) throw new Error('Backup contains invalid foreign key references');

  for (const model of Prisma.dmmf.datamodel.models) {
    const table = quoteIdentifier(model.dbName ?? model.name);
    const columns = await client.$queryRawUnsafe<Array<{ name: string; type: string; notnull: number; pk: number }>>(`PRAGMA table_info(${table})`);
    const columnTypes: Record<string, string[]> = { String: ['TEXT'], Boolean: ['BOOLEAN', 'INTEGER'], Int: ['INTEGER'], BigInt: ['BIGINT', 'INTEGER'], Float: ['REAL', 'DOUBLE', 'FLOAT'], DateTime: ['DATETIME', 'TIMESTAMP'], Bytes: ['BLOB'], Decimal: ['DECIMAL', 'NUMERIC'] };
    for (const field of model.fields.filter(field => field.kind !== 'object')) {
      const column = columns.find(column => column.name === (field.dbName ?? field.name));
      if (!column || (field.isRequired && !column.notnull && !column.pk) || (field.isId && !column.pk) || (columnTypes[field.type] && !columnTypes[field.type].includes(column.type.toUpperCase()))) throw new Error(`Backup schema is incompatible: ${model.name}.${field.name}`);
    }
    const indexes = await client.$queryRawUnsafe<Array<{ name: string; unique: number }>>(`PRAGMA index_list(${table})`);
    const uniqueColumns: string[][] = [];
    for (const index of indexes.filter(index => Boolean(index.unique))) {
      const fields = await client.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA index_info(${quoteIdentifier(index.name)})`);
      uniqueColumns.push(fields.map(field => field.name));
    }
    for (const unique of [...model.uniqueFields, ...model.fields.filter(field => field.isUnique).map(field => [field.name])]) {
      const expected = unique.map(name => model.fields.find(field => field.name === name)?.dbName ?? name);
      if (!uniqueColumns.some(actual => actual.length === expected.length && actual.every((name, index) => name === expected[index]))) throw new Error(`Backup is missing a unique constraint on ${model.name}`);
    }
    const constraints = await client.$queryRawUnsafe<Array<{ table: string; from: string; to: string; on_delete: string }>>(`PRAGMA foreign_key_list(${table})`);
    for (const relation of model.fields.filter(field => field.kind === 'object' && field.relationFromFields?.length)) {
      const target = Prisma.dmmf.datamodel.models.find(candidate => candidate.name === relation.type)!;
      const deleteAction = (relation.relationOnDelete ?? (relation.isRequired ? 'Restrict' : 'SetNull')).replace('SetNull', 'SET NULL').toUpperCase();
      for (let index = 0; index < relation.relationFromFields!.length; index++) {
        const from = model.fields.find(field => field.name === relation.relationFromFields![index])!;
        const to = target.fields.find(field => field.name === relation.relationToFields![index])!;
        if (!constraints.some(constraint => constraint.table === (target.dbName ?? target.name) && constraint.from === (from.dbName ?? from.name) && constraint.to === (to.dbName ?? to.name) && constraint.on_delete === deleteAction)) throw new Error(`Backup is missing a foreign key constraint on ${model.name}.${from.name}`);
      }
    }
    // Force SQLite to resolve every model column even when the table is empty.
    const fields = model.fields.filter(field => field.kind !== 'object').map(field => quoteIdentifier(field.dbName ?? field.name));
    await client.$queryRawUnsafe(`SELECT ${fields.join(', ')} FROM ${table} LIMIT 0`);
    // SQLite accepts dynamic column types; also verify that Prisma can decode rows.
    const delegateName = model.name[0].toLowerCase() + model.name.slice(1);
    const delegate = (client as unknown as Record<string, { findMany(options: { take: number; skip: number; orderBy: { id: 'asc' } }): Promise<unknown[]> }>)[delegateName];
    let skip = 0;
    for (;;) {
      try {
        const rows = await delegate.findMany({ take: 1000, skip, orderBy: { id: 'asc' } });
        if (rows.length < 1000) break;
        skip += rows.length;
      } catch {
        throw new Error(`Backup contains records incompatible with ${model.name}`);
      }
    }
  }
  const incomplete = await client.$queryRawUnsafe<unknown[]>('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL');
  if (incomplete.length) throw new Error('Backup contains an unfinished or failed migration; use offline recovery');
  const migrations = await client.$queryRawUnsafe<Array<{ migration_name: string; checksum: string }>>('SELECT migration_name, checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
  const migrationDirectory = path.join(path.dirname(getMigrationSchemaPath()), 'migrations');
  const expected = fs.readdirSync(migrationDirectory).filter(name => fs.existsSync(path.join(migrationDirectory, name, 'migration.sql')));
  if (migrations.length !== expected.length) throw new Error('Backup has a different migration history; use an offline database migration');
  for (const name of expected) {
    const script = fs.readFileSync(path.join(migrationDirectory, name, 'migration.sql'), 'utf8');
    const normalized = script.replace(/\r\n/g, '\n');
    const checksums = [script, normalized, normalized.replace(/\n/g, '\r\n')].map(contents => createHash('sha256').update(contents).digest('hex'));
    if (!migrations.some(migration => migration.migration_name === name && checksums.includes(migration.checksum))) throw new Error('Backup migration history does not match this application; use an offline database migration');
  }

  // A valid SQLite backup encrypted with another workspace key is unusable here.
  for (const [table, fields] of [
    ['employees', ['address', 'emergencyContact', 'emergencyPhone', 'bankRoutingNumber', 'bankAccountNumber']],
    ['businesses', ['ein', 'address']],
  ] as const) {
    let offset = 0;
    for (;;) {
      const rows = await client.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT ${fields.map(quoteIdentifier).join(', ')} FROM ${quoteIdentifier(table)} ORDER BY id LIMIT 1000 OFFSET ?`, offset);
      for (const row of rows) for (const value of Object.values(row)) {
        if (typeof value === 'string' && (value.startsWith('v1:') || isEncrypted(value))) {
          try { decrypt(value); } catch { throw new Error('Backup encryption key does not match this workspace; recover the original key before restoring'); }
        }
      }
      if (rows.length < 1000) break;
      offset += rows.length;
    }
  }
  let skip = 0;
  for (;;) {
    const settings = await client.appSetting.findMany({ where: { key: { startsWith: 'pos.connection.v1:' } }, take: 1000, skip, orderBy: { id: 'asc' } });
    for (const setting of settings) {
      try {
        if (!isEncrypted(setting.value)) throw new Error('Unencrypted POS connection');
        const record = JSON.parse(decrypt(setting.value) ?? '');
        if (!record.connection || !record.credentials || !['square', 'toast'].includes(record.credentials.provider) || record.credentials.provider !== record.connection.provider || !Array.isArray(record.connection.locations)) throw new Error('Invalid POS connection');
      } catch {
        throw new Error('Backup POS credentials cannot be read with the current encryption key; recover the original key or repair the connection record offline');
      }
    }
    if (settings.length < 1000) break;
    skip += settings.length;
  }
}

/**
 * List all available backups
 */
export function listDatabaseBackups(): Array<{name: string, path: string, size: number, created: Date}> {
  try {
    const backupsDir = getBackupsDirectory();
    const backups = [];
    
    if (fs.existsSync(backupsDir)) {
      const files = fs.readdirSync(backupsDir);
      
      for (const file of files) {
        if (file.endsWith('.db')) {
          const filePath = path.join(backupsDir, file);
          if (fs.lstatSync(filePath).isSymbolicLink()) continue;
          const stats = fs.statSync(filePath);
          
          backups.push({
            name: file,
            path: filePath,
            size: stats.size,
            created: stats.mtime
          });
        }
      }
    }
    
    // Sort by creation date (newest first)
    return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
  } catch (error) {
    logger.error('Failed to list backups:', error);
    return [];
  }
}

/**
 * Delete a backup file
 */
export function deleteDatabaseBackup(backupPath: string): void {
  try {
    backupPath = resolveBackupPath(backupPath);
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
      logger.info('Backup deleted:', backupPath);
    }
  } catch (error) {
    logger.error('Failed to delete backup:', error);
    throw error;
  }
}

/**
 * Validate that a file is a valid SQLite database
 */
export function resolveBackupPath(candidate: string): string {
  const directory = fs.realpathSync(getBackupsDirectory());
  const resolved = path.resolve(candidate);
  const parent = fs.realpathSync(path.dirname(resolved));
  if (parent !== directory) throw new Error('Backup path must stay inside the backup directory');
  if (fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink()) throw new Error('Backup links are not permitted');
  return resolved;
}

async function validateSQLiteFile(filePath: string): Promise<void> {
  try {
    // Read first 16 bytes to check SQLite header
    const fileHandle = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(16);
    try { fs.readSync(fileHandle, buffer, 0, 16, 0); } finally { fs.closeSync(fileHandle); }
    
    const header = buffer.toString('ascii');
    if (header !== 'SQLite format 3\u0000') {
      throw new Error('Invalid SQLite database file');
    }
  } catch (error) {
    throw new Error(`Invalid backup file: ${error.message}`);
  }
}
