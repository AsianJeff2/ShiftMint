import { afterEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ execute: vi.fn((_file, _args, _options, callback) => callback(null, '', '')) }));
vi.mock('node:child_process', () => ({ execFile: fixture.execute }));
vi.mock('../../lib/infrastructure/Logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
import { buildMigrationEnvironment, runDatabaseMigrations } from '../../electron/backend/migrations';

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('Prisma migration subprocess environment', () => {
  it('passes only database and platform/native-engine requirements, disabling checkpoint', () => {
    const source = {
      DATABASE_URL: 'file:/fixture/shiftmint.db', Path: '/fixture/bin', SystemRoot: '/fixture/windows',
      WINDIR: '/fixture/windows', COMSPEC: '/fixture/cmd', PATHEXT: '.EXE',
      HOME: '/fixture/home', USERPROFILE: '/fixture/profile', APPDATA: '/fixture/roaming',
      TEMP: '/fixture/temp', TMPDIR: '/fixture/tmp', LANG: 'en_US.UTF-8', LC_ALL: 'C.UTF-8',
      LD_LIBRARY_PATH: '/fixture/lib', DYLD_LIBRARY_PATH: '/fixture/mac-lib',
      PRISMA_SCHEMA_ENGINE_BINARY: '/fixture/schema-engine', PRISMA_QUERY_ENGINE_LIBRARY: '/fixture/query-engine',
      JWT_SECRET: 'fixture-jwt', ENCRYPTION_KEY: 'fixture-encryption', BOOTSTRAP_TOKEN: 'fixture-bootstrap',
      SHIFTMINT_DESKTOP_TOKEN: 'fixture-capability', SQUARE_ACCESS_TOKEN: 'fixture-pos',
      NODE_OPTIONS: '--require=/fixture/unsafe-preload', PRISMA_TELEMETRY_INFORMATION: 'fixture-telemetry',
      CHECKPOINT_DISABLE: '0', ELECTRON_RUN_AS_NODE: '0',
    };
    const result = buildMigrationEnvironment(source);
    const { JWT_SECRET, ENCRYPTION_KEY, BOOTSTRAP_TOKEN, SHIFTMINT_DESKTOP_TOKEN, SQUARE_ACCESS_TOKEN,
      NODE_OPTIONS, PRISMA_TELEMETRY_INFORMATION, ...expected } = source;
    expect(result).toEqual({ ...expected, CHECKPOINT_DISABLE: '1', ELECTRON_RUN_AS_NODE: '1' });
    expect(source.CHECKPOINT_DISABLE).toBe('0');
  });

  it('uses the restricted environment for the actual migration child invocation', async () => {
    vi.stubEnv('DATABASE_URL', 'file:/fixture/shiftmint.db');
    vi.stubEnv('JWT_SECRET', 'fixture-jwt');
    vi.stubEnv('ENCRYPTION_KEY', 'fixture-encryption');
    vi.stubEnv('SHIFTMINT_DESKTOP_TOKEN', 'fixture-capability');
    vi.stubEnv('CHECKPOINT_DISABLE', '0');
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]), $connect: vi.fn(), $disconnect: vi.fn(),
      appSetting: { upsert: vi.fn(), update: vi.fn() },
    };

    await expect(runDatabaseMigrations(prisma as never)).resolves.toMatchObject({ success: true, isFirstTime: true });
    const options = fixture.execute.mock.calls[0][2];
    expect(options.env).toEqual(buildMigrationEnvironment(process.env));
    expect(options.env).toMatchObject({ DATABASE_URL: 'file:/fixture/shiftmint.db', CHECKPOINT_DISABLE: '1', ELECTRON_RUN_AS_NODE: '1' });
    for (const secret of ['JWT_SECRET', 'ENCRYPTION_KEY', 'SHIFTMINT_DESKTOP_TOKEN']) expect(options.env).not.toHaveProperty(secret);
    expect(options.windowsHide).toBe(true);
    expect(prisma.$connect).toHaveBeenCalledOnce();
  });
});
