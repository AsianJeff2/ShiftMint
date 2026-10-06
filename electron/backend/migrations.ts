import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { logger } from '../../lib/infrastructure/Logger';

const executeFile = promisify(execFile);
export interface MigrationResult { success: boolean; isFirstTime: boolean; version: string; error?: string; }
const alignmentMigration = '20261005000000_schema_alignment';
const legacyShiftColumns = ['position', 'employeeType', 'stationNumber', 'hourlyRate', 'regularWage', 'overtimeWage', 'totalWage'];

/** The CLI needs native-engine/platform paths, not application or POS credentials. */
export function buildMigrationEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const allowed = new Set([
    'DATABASE_URL', 'PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC',
    'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'XDG_CACHE_HOME',
    'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'NODE_ENV',
    'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH', 'DYLD_FALLBACK_LIBRARY_PATH',
    'OPENSSL_CONF', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS',
    'PRISMA_SCHEMA_ENGINE_BINARY', 'PRISMA_QUERY_ENGINE_BINARY', 'PRISMA_QUERY_ENGINE_LIBRARY',
    'PRISMA_CLI_QUERY_ENGINE_TYPE', 'PRISMA_CLI_BINARY_TARGETS',
  ]);
  const environment: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    // Windows names such as Path and SystemRoot retain their original spelling.
    if (value !== undefined && allowed.has(key.toUpperCase())) environment[key] = value;
  }
  return { ...environment, ELECTRON_RUN_AS_NODE: '1', CHECKPOINT_DISABLE: '1' };
}

export function getMigrationSchemaPath(): string {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (process.versions.electron && resourcesPath) {
    const bundled = path.join(resourcesPath, 'prisma', 'schema.prisma');
    if (fs.existsSync(bundled)) return bundled;
  }
  let directory = __dirname;
  for (;;) {
    const candidate = path.join(directory, 'prisma', 'schema.prisma');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error('Bundled Prisma schema and migration history are missing');
    directory = parent;
  }
}

export async function initializeDefaultSettings(prisma: PrismaClient): Promise<void> {
  for (const setting of [
    { key: 'first_launch', value: 'true' }, { key: 'schema_version', value: '2.1.0' },
    { key: 'app_version', value: '2.1.0' }, { key: 'last_backup', value: 'never' },
  ]) await prisma.appSetting.upsert({ where: { key: setting.key }, update: {}, create: setting });
  await prisma.appSetting.update({ where: { key: 'schema_version' }, data: { value: '2.1.0' } });
  await prisma.appSetting.update({ where: { key: 'app_version' }, data: { value: '2.1.0' } });
}

/** The 2025 runtime also altered tables outside Prisma's recorded migration history. */
export async function assertMigrationHistoryIsSafe(prisma: PrismaClient): Promise<boolean> {
  const tables = await prisma.$queryRaw<Array<{ name: string }>>`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`;
  if (tables.length === 0) return true;
  if (!tables.some(table => table.name === '_prisma_migrations')) {
    throw new Error('Legacy database has no Prisma migration history. Preserve a backup and follow docs/DATABASE_MIGRATION.md before upgrading; automatic baselining is disabled.');
  }
  const applied = await prisma.$queryRaw<Array<{ migration_name: string }>>`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  if (!applied.some(migration => migration.migration_name === alignmentMigration) && tables.some(table => table.name === 'shifts')) {
    const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("shifts")');
    const existing = legacyShiftColumns.filter(column => columns.some(candidate => candidate.name === column));
    if (existing.length) {
      throw new Error(`Legacy runtime schema changes detected in shifts (${existing.join(', ')}). No migration was applied. Preserve the database and original encryption key and follow docs/DATABASE_MIGRATION.md for an offline upgrade.`);
    }
  }
  return false;
}

export async function runDatabaseMigrations(prisma: PrismaClient, backupBeforeUpgrade?: () => Promise<unknown>): Promise<MigrationResult> {
  let isFirstTime = false;
  try {
    isFirstTime = await assertMigrationHistoryIsSafe(prisma);
    const schema = getMigrationSchemaPath();
    if (!isFirstTime && backupBeforeUpgrade) {
      const applied = await prisma.$queryRaw<Array<{ migration_name: string }>>`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
      const migrationDirectory = path.join(path.dirname(schema), 'migrations');
      const pending = fs.readdirSync(migrationDirectory).some(name => fs.existsSync(path.join(migrationDirectory, name, 'migration.sql')) && !applied.some(migration => migration.migration_name === name));
      if (pending) await backupBeforeUpgrade();
    }
    let cli = path.join(path.dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
    const unpackedCli = cli.replace(/\.asar([\\/])/, '.asar.unpacked$1');
    if (unpackedCli !== cli && fs.existsSync(unpackedCli)) cli = unpackedCli;
    await prisma.$disconnect();
    await executeFile(process.execPath, [cli, 'migrate', 'deploy', '--schema', schema], {
      cwd: path.dirname(schema), env: buildMigrationEnvironment(),
      windowsHide: true, timeout: 120000, maxBuffer: 2 * 1024 * 1024,
    });
    await prisma.$connect();
    await initializeDefaultSettings(prisma);
    logger.info('Canonical Prisma migrations applied');
    return { success: true, isFirstTime, version: '2.1.0' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database migration failed';
    logger.error('Database migration failed', { message });
    return { success: false, isFirstTime, version: 'unknown', error: message };
  }
}
