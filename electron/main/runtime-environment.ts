import { randomBytes } from 'crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { homedir, platform } from 'os';
import { fileURLToPath } from 'url';

interface DesktopSecrets {
  version: 1;
  jwtSecret: string;
  encryptionKey: string;
}

interface DesktopEnvironmentOptions {
  dataDirectory?: string;
  environment?: NodeJS.ProcessEnv;
}

function legacyDataDirectory(): string {
  switch (platform()) {
    case 'win32': return join(homedir(), 'AppData', 'Roaming', 'ShiftMint');
    case 'darwin': return join(homedir(), 'Library', 'Application Support', 'ShiftMint');
    default: return join(homedir(), '.shiftmint');
  }
}

function sqliteFilePath(databaseUrl: string): string {
  if (!databaseUrl.startsWith('file:') || databaseUrl.slice(5).split('?')[0].length === 0) {
    throw new Error('Desktop runtime requires a SQLite file database URL');
  }
  return databaseUrl.startsWith('file://')
    ? fileURLToPath(databaseUrl)
    : resolve(databaseUrl.slice(5).split('?')[0]);
}

function validSecrets(value: unknown): value is DesktopSecrets {
  if (!value || typeof value !== 'object') return false;
  const secrets = value as Record<string, unknown>;
  return secrets.version === 1 && typeof secrets.jwtSecret === 'string' && secrets.jwtSecret.length >= 32 &&
    typeof secrets.encryptionKey === 'string' && /^[a-f0-9]{64}$/i.test(secrets.encryptionKey);
}

// Inspect ciphertext markers without loading records or exposing their contents.
function hasEncryptedRecords(databasePath: string): boolean {
  for (const path of [databasePath, `${databasePath}-wal`]) {
    if (!existsSync(path)) continue;
    const descriptor = openSync(path, 'r');
    const buffer = Buffer.alloc(64 * 1024);
    let tail = '';
    try {
      let bytes: number;
      while ((bytes = readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
        const chunk = tail + buffer.subarray(0, bytes).toString('latin1');
        if (/(?:v1:)?[a-f0-9]{32}:[a-f0-9]{32}:[a-f0-9]+/i.test(chunk)) return true;
        tail = chunk.slice(-128);
      }
    } finally {
      closeSync(descriptor);
    }
  }
  return false;
}

export function initializeDesktopEnvironment(options: DesktopEnvironmentOptions = {}): {
  dataDirectory: string;
  secretsPath: string;
} {
  const environment = options.environment || process.env;
  const configuredDatabase = environment.DATABASE_URL ? sqliteFilePath(environment.DATABASE_URL) : undefined;
  const dataDirectory = resolve(options.dataDirectory || environment.SHIFTMINT_DATA_DIR ||
    (configuredDatabase ? dirname(configuredDatabase) : legacyDataDirectory()));
  const databasePath = configuredDatabase || join(dataDirectory, 'shiftmint.db');
  const secretsPath = join(dataDirectory, 'runtime-secrets.json');

  let stored: DesktopSecrets | undefined;
  if (existsSync(secretsPath)) {
    const value: unknown = JSON.parse(readFileSync(secretsPath, 'utf8'));
    if (!validSecrets(value)) throw new Error('Desktop secret file is invalid. Restore the original secret file.');
    stored = value;
  }
  if (environment.JWT_SECRET && environment.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }
  if (environment.ENCRYPTION_KEY && !/^[a-f0-9]{64}$/i.test(environment.ENCRYPTION_KEY)) {
    throw new Error('ENCRYPTION_KEY must contain 64 hexadecimal characters');
  }
  if (stored && ((environment.ENCRYPTION_KEY && environment.ENCRYPTION_KEY !== stored.encryptionKey) ||
      (environment.JWT_SECRET && environment.JWT_SECRET !== stored.jwtSecret))) {
    throw new Error('Configured desktop secrets do not match this workspace. Restore the original configuration.');
  }
  if (!stored && !environment.ENCRYPTION_KEY && hasEncryptedRecords(databasePath)) {
    throw new Error('This database contains encrypted records. Restore its original ENCRYPTION_KEY before opening it.');
  }

  const secrets: DesktopSecrets = stored || {
    version: 1,
    jwtSecret: environment.JWT_SECRET || randomBytes(32).toString('hex'),
    encryptionKey: environment.ENCRYPTION_KEY || randomBytes(32).toString('hex'),
  };
  if (!stored) {
    mkdirSync(dataDirectory, { recursive: true });
    writeFileSync(secretsPath, JSON.stringify(secrets) + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  }
  environment.JWT_SECRET = secrets.jwtSecret;
  environment.ENCRYPTION_KEY = secrets.encryptionKey;
  environment.SHIFTMINT_DATA_DIR = dataDirectory;
  // A fresh per-launch capability binds first-account setup to the trusted shell.
  // It is delivered through validated IPC and never persisted with workspace keys.
  environment.BOOTSTRAP_TOKEN = randomBytes(32).toString('base64');
  if (!environment.DATABASE_URL) environment.DATABASE_URL = `file:${databasePath}`;
  return { dataDirectory, secretsPath };
}
