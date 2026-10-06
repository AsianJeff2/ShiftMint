import { getPrismaClient } from '../database';
import { encrypt, decrypt, isEncrypted } from '../../../lib/security/encryption';
import { validatePosConnection, previewPos, type PosConnectionRecord } from '../../../lib/pos/adapters';
import type { PosConnectInput, PosConnection, PosProvider, PosPreviewInput } from '../../../lib/pos/contracts';
import { PosError } from '../../../lib/pos/transport';

const locks = new Map<string, Promise<void>>();

export function posConnectionKey(businessId: string, provider: PosProvider): string {
  if (!businessId) throw new PosError('AUTHENTICATION_REQUIRED', 'Authentication required.', 401);
  return `pos.connection.v1:${encodeURIComponent(businessId)}:${provider}`;
}

function requireEncryption(): void {
  if (!/^[a-fA-F0-9]{64}$/.test(process.env.ENCRYPTION_KEY ?? '')) {
    throw new PosError('POS_ENCRYPTION_REQUIRED', 'The server administrator must configure ENCRYPTION_KEY before saving or using POS credentials.', 503);
  }
}

async function withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const operationPromise = previous.then(operation);
  const tail = operationPromise.then(() => undefined, () => undefined);
  locks.set(key, tail);
  try { return await operationPromise; }
  finally { if (locks.get(key) === tail) locks.delete(key); }
}

async function load(key: string): Promise<PosConnectionRecord | null> {
  const setting = await getPrismaClient().appSetting.findUnique({ where: { key } });
  if (!setting) return null;
  requireEncryption();
  try {
    if (!isEncrypted(setting.value)) throw new Error('Unencrypted connection');
    const decrypted = decrypt(setting.value);
    if (!decrypted) throw new Error('Empty connection');
    const record = JSON.parse(decrypted) as PosConnectionRecord;
    if (!record.connection || !record.credentials || record.credentials.provider !== record.connection.provider || !Array.isArray(record.connection.locations)) throw new Error('Invalid connection');
    return record;
  } catch {
    throw new PosError('POS_CONNECTION_UNREADABLE', 'Stored POS credentials could not be decrypted. Check the server encryption key or reconnect.', 503);
  }
}

async function save(key: string, record: PosConnectionRecord): Promise<void> {
  requireEncryption();
  const value = encrypt(JSON.stringify(record));
  if (!value) throw new PosError('POS_ENCRYPTION_FAILED', 'POS credentials could not be encrypted.', 503);
  await getPrismaClient().appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export async function getPosConnections(businessId: string): Promise<PosConnection[]> {
  const results = await Promise.all((['square', 'toast'] as const).map(provider => load(posConnectionKey(businessId, provider))));
  return results.flatMap(record => record ? [record.connection] : []);
}

export async function connectPos(businessId: string, input: PosConnectInput): Promise<PosConnection> {
  requireEncryption();
  const key = posConnectionKey(businessId, input.provider);
  return withLock(key, async () => {
    const record = await validatePosConnection(input);
    await save(key, record);
    return record.connection;
  });
}

export async function disconnectPos(businessId: string, provider: PosProvider): Promise<void> {
  const key = posConnectionKey(businessId, provider);
  await withLock(key, async () => { await getPrismaClient().appSetting.deleteMany({ where: { key } }); });
}

export async function previewPosConnection(businessId: string, provider: PosProvider, input: PosPreviewInput) {
  const key = posConnectionKey(businessId, provider);
  return withLock(key, async () => {
    const record = await load(key);
    if (!record) throw new PosError('POS_NOT_CONNECTED', 'Connect this POS provider before requesting a preview.', 404);
    const previousToken = JSON.stringify(record.toastToken);
    try {
      const preview = await previewPos(record, input);
      record.connection.status = 'validated';
      record.connection.validatedAt = preview.fetchedAt;
      await save(key, record);
      return preview;
    } catch (error) {
      const rejectedCredentials = error instanceof PosError && ['PROVIDER_UNAUTHORIZED', 'PROVIDER_PERMISSION_DENIED'].includes(error.code);
      if (rejectedCredentials) {
        record.connection.status = 'needs_attention';
      }
      // Retain a successfully refreshed token even if a later read is throttled or unavailable.
      // Otherwise retries would repeat authentication and exhaust Toast's authentication limit.
      if (rejectedCredentials || previousToken !== JSON.stringify(record.toastToken)) await save(key, record);
      throw error;
    }
  });
}
