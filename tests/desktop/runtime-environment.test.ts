import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, resolve, sep } from 'path';
import { initializeDesktopEnvironment } from '../../electron/main/runtime-environment';

const scratchRoot = resolve(process.cwd(), '.tmp-tests/desktop-runtime');
mkdirSync(scratchRoot, { recursive: true });
const directories: string[] = [];
function workspace(): string {
  const directory = mkdtempSync(join(scratchRoot, 'workspace-'));
  directories.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0)) {
    if (!resolve(directory).startsWith(scratchRoot + sep)) throw new Error('Invalid fixture cleanup path');
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('desktop workspace secrets', () => {
  it('creates random secrets once and reuses them on later starts', () => {
    const dataDirectory = workspace();
    const first: NodeJS.ProcessEnv = {};
    const result = initializeDesktopEnvironment({ dataDirectory, environment: first });
    const originalFile = readFileSync(result.secretsPath, 'utf8');
    const second: NodeJS.ProcessEnv = {};
    initializeDesktopEnvironment({ dataDirectory, environment: second });
    expect(second.JWT_SECRET).toBe(first.JWT_SECRET);
    expect(second.ENCRYPTION_KEY).toBe(first.ENCRYPTION_KEY);
    expect(second.ENCRYPTION_KEY).toMatch(/^[a-f0-9]{64}$/);
    expect(readFileSync(result.secretsPath, 'utf8')).toBe(originalFile);
    expect(second.SHIFTMINT_DATA_DIR).toBe(dataDirectory);
    expect(second.DATABASE_URL).toBe(`file:${join(dataDirectory, 'shiftmint.db')}`);
  });

  it('does not silently replace an existing encryption key', () => {
    const dataDirectory = workspace();
    const { secretsPath } = initializeDesktopEnvironment({ dataDirectory, environment: {} });
    const originalFile = readFileSync(secretsPath, 'utf8');
    expect(() => initializeDesktopEnvironment({ dataDirectory, environment: { ENCRYPTION_KEY: 'a'.repeat(64) } }))
      .toThrow('do not match');
    expect(readFileSync(secretsPath, 'utf8')).toBe(originalFile);
  });

  it.each(['', 'v1:'])('refuses automatic rekey when encrypted records exist (%s)', prefix => {
    const dataDirectory = workspace();
    writeFileSync(join(dataDirectory, 'shiftmint.db'), `SQLite format 3\0${prefix}${'a'.repeat(32)}:${'b'.repeat(32)}:cc`);
    expect(() => initializeDesktopEnvironment({ dataDirectory, environment: {} })).toThrow('original ENCRYPTION_KEY');
    expect(existsSync(join(dataDirectory, 'runtime-secrets.json'))).toBe(false);
  });

  it('checks SQLite write-ahead data before generating a new key', () => {
    const dataDirectory = workspace();
    writeFileSync(join(dataDirectory, 'shiftmint.db-wal'), `${'a'.repeat(32)}:${'b'.repeat(32)}:cc`);
    expect(() => initializeDesktopEnvironment({ dataDirectory, environment: {} })).toThrow('original ENCRYPTION_KEY');
  });

  it('can initialize legacy plaintext workspaces without changing the database', () => {
    const dataDirectory = workspace();
    const path = join(dataDirectory, 'shiftmint.db');
    writeFileSync(path, 'SQLite format 3\0plaintext legacy record');
    initializeDesktopEnvironment({ dataDirectory, environment: {} });
    expect(readFileSync(path, 'utf8')).toBe('SQLite format 3\0plaintext legacy record');
  });

  it('preserves a supplied recovery key and explicit database location', () => {
    const dataDirectory = workspace();
    const databasePath = join(dataDirectory, 'recovered.db');
    writeFileSync(databasePath, `${'a'.repeat(32)}:${'b'.repeat(32)}:cc`);
    const environment: NodeJS.ProcessEnv = {
      DATABASE_URL: `file:${databasePath}`,
      ENCRYPTION_KEY: 'c'.repeat(64),
      JWT_SECRET: 'd'.repeat(64),
    };
    const result = initializeDesktopEnvironment({ environment });
    expect(result.dataDirectory).toBe(dataDirectory);
    expect(environment.ENCRYPTION_KEY).toBe('c'.repeat(64));
    expect(environment.DATABASE_URL).toBe(`file:${databasePath}`);
  });

  it('rejects invalid stored secrets without overwriting them', () => {
    const dataDirectory = workspace();
    const path = join(dataDirectory, 'runtime-secrets.json');
    writeFileSync(path, '{}');
    expect(() => initializeDesktopEnvironment({ dataDirectory, environment: {} })).toThrow('secret file is invalid');
    expect(readFileSync(path, 'utf8')).toBe('{}');
  });
});
