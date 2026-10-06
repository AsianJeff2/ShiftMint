import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { encrypt, decrypt } from '../../../lib/security/encryption';
import { PosError } from '../../../lib/pos/transport';
import type { PosConnectionRecord } from '../../../lib/pos/adapters';

const fixture = vi.hoisted(() => ({ rows: new Map<string, string>(), findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), validate: vi.fn(), preview: vi.fn() }));
vi.mock('../database', () => ({ getPrismaClient: () => ({ appSetting: { findUnique: fixture.findUnique, upsert: fixture.upsert, deleteMany: fixture.deleteMany } }) }));
vi.mock('../../../lib/pos/adapters', () => ({ validatePosConnection: fixture.validate, previewPos: fixture.preview }));
import { connectPos, disconnectPos, getPosConnections, posConnectionKey, previewPosConnection } from './pos-connections';

function record(): PosConnectionRecord {
  return { credentials: { provider: 'square', environment: 'sandbox', accessToken: 'secret-merchant-token' }, connection: { provider: 'square', environment: 'sandbox', status: 'validated', validatedAt: '2026-10-05T00:00:00Z', locations: [{ id: 'location-a', name: 'Restaurant', currency: 'USD' }], warnings: [] } };
}
beforeEach(() => {
  vi.clearAllMocks(); fixture.rows.clear(); vi.stubEnv('ENCRYPTION_KEY', 'ab'.repeat(32));
  fixture.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => fixture.rows.has(where.key) ? { key: where.key, value: fixture.rows.get(where.key) } : null);
  fixture.upsert.mockImplementation(async ({ where, create }: { where: { key: string }; create: { value: string } }) => { fixture.rows.set(where.key, create.value); return { key: where.key, value: create.value }; });
  fixture.deleteMany.mockImplementation(async ({ where }: { where: { key: string } }) => ({ count: Number(fixture.rows.delete(where.key)) }));
  fixture.validate.mockImplementation(async () => record());
  fixture.preview.mockResolvedValue({ provider: 'square', sales: [], labor: [], catalog: [], warnings: [], previewOnly: true, startDate: '', endDate: '', fetchedAt: '2026-10-05T12:00:00Z' });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('POS credential storage boundaries', () => {
  it('persists encrypted credentials and exposes public connection metadata only', async () => {
    const connected = await connectPos('business-a', record().credentials);
    const value = fixture.rows.get(posConnectionKey('business-a', 'square'))!;
    expect(value).toMatch(/^v1:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    expect(value).not.toContain('secret-merchant-token');
    expect(JSON.parse(decrypt(value)!)).toMatchObject({ credentials: { accessToken: 'secret-merchant-token' } });
    expect(JSON.stringify(connected)).not.toContain('secret-merchant-token');
    expect(await getPosConnections('business-a')).toEqual([connected]);
  });

  it('never reads or deletes another authenticated business connection', async () => {
    await connectPos('business-a', record().credentials);
    expect(await getPosConnections('business-b')).toEqual([]);
    await expect(previewPosConnection('business-b', 'square', { startDate: '', endDate: '' })).rejects.toMatchObject({ code: 'POS_NOT_CONNECTED' });
    await disconnectPos('business-b', 'square');
    expect(fixture.rows.has(posConnectionKey('business-a', 'square'))).toBe(true);
    expect(fixture.deleteMany).toHaveBeenCalledWith({ where: { key: posConnectionKey('business-b', 'square') } });
  });

  it('requires a configured encryption key before validating or storing provider credentials', async () => {
    vi.stubEnv('ENCRYPTION_KEY', '');
    await expect(connectPos('business-a', record().credentials)).rejects.toMatchObject({ code: 'POS_ENCRYPTION_REQUIRED', status: 503 });
    expect(fixture.validate).not.toHaveBeenCalled(); expect(fixture.upsert).not.toHaveBeenCalled();
  });

  it('rejects plaintext credentials even though legacy employee decryption accepts plaintext', async () => {
    fixture.rows.set(posConnectionKey('business-a', 'square'), JSON.stringify(record()));
    await expect(getPosConnections('business-a')).rejects.toMatchObject({ code: 'POS_CONNECTION_UNREADABLE' });
  });

  it('marks rejected provider credentials as needing attention without leaking them', async () => {
    fixture.rows.set(posConnectionKey('business-a', 'square'), encrypt(JSON.stringify(record()))!);
    fixture.preview.mockRejectedValue(new PosError('PROVIDER_UNAUTHORIZED', 'Reconnect.', 422));
    await expect(previewPosConnection('business-a', 'square', { startDate: '', endDate: '' })).rejects.toMatchObject({ code: 'PROVIDER_UNAUTHORIZED' });
    expect((await getPosConnections('business-a'))[0].status).toBe('needs_attention');
  });

  it('persists a refreshed Toast token when the following data read is throttled', async () => {
    const connected: PosConnectionRecord = { ...record(), credentials: { provider: 'toast', clientId: 'client', clientSecret: 'secret', locationIds: ['T1'], currency: 'USD' }, connection: { ...record().connection, provider: 'toast', environment: 'production' }, toastToken: { accessToken: 'old-token', expiresAt: 1 } };
    fixture.rows.set(posConnectionKey('business-a', 'toast'), encrypt(JSON.stringify(connected))!);
    fixture.preview.mockImplementation(async (connection: PosConnectionRecord) => { connection.toastToken = { accessToken: 'new-token', expiresAt: Date.now() + 86400_000 }; throw new PosError('PROVIDER_RATE_LIMITED', 'Retry later.', 429); });
    await expect(previewPosConnection('business-a', 'toast', { startDate: '', endDate: '' })).rejects.toMatchObject({ code: 'PROVIDER_RATE_LIMITED' });
    const saved = JSON.parse(decrypt(fixture.rows.get(posConnectionKey('business-a', 'toast'))!)!);
    expect(saved.toastToken.accessToken).toBe('new-token');
    expect(saved.connection.validatedAt).toBe(connected.connection.validatedAt);
  });

  it('serializes token refresh and disconnection for one business/provider', async () => {
    fixture.rows.set(posConnectionKey('business-a', 'square'), encrypt(JSON.stringify(record()))!);
    let release: (() => void) | undefined;
    fixture.preview.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({ provider: 'square', sales: [], labor: [], catalog: [], previewOnly: true, fetchedAt: '2026-10-05T12:00:00Z' }); }));
    const preview = previewPosConnection('business-a', 'square', { startDate: '', endDate: '' });
    const disconnected = disconnectPos('business-a', 'square');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(fixture.deleteMany).not.toHaveBeenCalled();
    release!(); await preview; await disconnected;
    expect(fixture.rows.has(posConnectionKey('business-a', 'square'))).toBe(false);
  });
});
