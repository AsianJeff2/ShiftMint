import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import winston from 'winston';

const runtime = vi.hoisted(() => ({ test: false, development: false }));
vi.mock('./ConfigurationService', () => ({ config: {
  get: (key: string) => key === 'logLevel' ? 'info' : process.env.DATABASE_URL,
  isTest: () => runtime.test,
  isDevelopment: () => runtime.development,
} }));

describe('runtime logger', () => {
  let dataDirectory: string;
  let created: winston.Logger[];
  let stdout: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    const fixtureRoot = path.resolve(process.cwd(), '.tmp-tests/logger');
    fs.mkdirSync(fixtureRoot, { recursive: true });
    dataDirectory = fs.mkdtempSync(path.join(fixtureRoot, 'runtime-'));
    vi.stubEnv('SHIFTMINT_DATA_DIR', dataDirectory);
    vi.stubEnv('DATABASE_URL', `file:${path.join(dataDirectory, 'shiftmint.db')}`);
    runtime.test = false;
    runtime.development = false;
    created = [];
    const original = winston.createLogger.bind(winston);
    vi.spyOn(winston, 'createLogger').mockImplementation(options => {
      const result = original(options);
      created.push(result);
      return result;
    });
    const stream = (console as unknown as { _stdout?: NodeJS.WriteStream })._stdout;
    stdout = stream ? vi.spyOn(stream, 'write').mockImplementation(() => true) : vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const logger of created) logger.close();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    const fixtureRoot = path.resolve(process.cwd(), '.tmp-tests/logger');
    if (!path.resolve(dataDirectory).startsWith(fixtureRoot + path.sep)) throw new Error('Invalid logger fixture cleanup path');
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  });

  it('emits production JSON to stdout and persists records beneath the configured data directory', async () => {
    const { logger } = await import('./Logger');
    logger.info('production-start-marker', { event: 'startup' });
    logger.error('production-error-marker');
    const logDirectory = path.join(dataDirectory, 'logs');
    await vi.waitFor(() => {
      expect(fs.readFileSync(path.join(logDirectory, 'combined.log'), 'utf8')).toContain('production-start-marker');
      expect(fs.readFileSync(path.join(logDirectory, 'error.log'), 'utf8')).toContain('production-error-marker');
    });
    const output = stdout.mock.calls.map(call => String(call[0])).join('');
    const record = output.split('\n').filter(Boolean).map(line => JSON.parse(line)).find(record => record.message === 'production-start-marker');
    expect(record).toMatchObject({ level: 'info', metadata: { event: 'startup' } });
    expect(record.metadata.timestamp).toEqual(expect.any(String));
  });

  it('rejects a relative configured data directory before creating transports', async () => {
    vi.stubEnv('SHIFTMINT_DATA_DIR', 'relative-workspace');
    await expect(import('./Logger')).rejects.toThrow('SHIFTMINT_DATA_DIR must be an absolute path');
    expect(created).toHaveLength(0);
  });

  it('uses the absolute SQLite directory when only DATABASE_URL configures persistent storage', async () => {
    vi.stubEnv('SHIFTMINT_DATA_DIR', '');
    const { logger } = await import('./Logger');
    logger.info('database-directory-marker');
    await vi.waitFor(() => expect(fs.readFileSync(path.join(dataDirectory, 'logs', 'combined.log'), 'utf8')).toContain('database-directory-marker'));
  });

  it('leaves test imports silent without creating log directories or transports', async () => {
    runtime.test = true;
    const { logger } = await import('./Logger');
    logger.info('test-only-marker');
    expect(fs.existsSync(path.join(dataDirectory, 'logs'))).toBe(false);
    expect(created).toHaveLength(0);
    expect(stdout).not.toHaveBeenCalled();
  });
});
