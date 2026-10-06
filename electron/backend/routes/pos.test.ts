import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { PosError } from '../../../lib/pos/transport';

const fixture = vi.hoisted(() => ({ role: 'owner' as string | undefined, connect: vi.fn(), disconnect: vi.fn(), list: vi.fn(), preview: vi.fn() }));
vi.mock('./auth', () => ({ protect: (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!fixture.role) { res.status(401).json({ success: false, message: 'Authentication required.' }); return; }
  Object.assign(req, { user: { id: 'user-a', userId: 'user-a', email: 'owner@example.test', role: fixture.role, businessId: 'business-a' } }); next();
} }));
vi.mock('../services/pos-connections', () => ({ connectPos: fixture.connect, disconnectPos: fixture.disconnect, getPosConnections: fixture.list, previewPosConnection: fixture.preview }));
import router from './pos';

let server: Server | undefined;
async function request(endpoint: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  const app = express(); app.use(express.json()); app.use('/api/pos', router);
  server ??= app.listen(0, '127.0.0.1');
  if (!server.listening) await new Promise<void>(resolve => server!.once('listening', resolve));
  const address = server.address() as { port: number };
  return fetch(`http://127.0.0.1:${address.port}/api/pos${endpoint}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => { vi.clearAllMocks(); fixture.role = 'owner'; fixture.list.mockResolvedValue([]); fixture.connect.mockResolvedValue({ provider: 'square', status: 'validated' }); });
afterEach(async () => { if (server) await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; });

describe('POS HTTP access and validation boundaries', () => {
  it('rejects anonymous and staff callers before loading credentials', async () => {
    fixture.role = undefined;
    expect((await request('/connections')).status).toBe(401);
    fixture.role = 'staff';
    expect((await request('/connections')).status).toBe(403);
    expect(fixture.list).not.toHaveBeenCalled();
  });

  it('permits a manager and derives business scope from the authenticated session', async () => {
    fixture.role = 'manager';
    expect((await request('/connections')).status).toBe(200);
    expect(fixture.list).toHaveBeenCalledWith('business-a');
    const response = await request('/connections', { provider: 'square', environment: 'sandbox', accessToken: 'merchant-secret' });
    expect(response.status).toBe(200);
    expect(fixture.connect).toHaveBeenCalledWith('business-a', { provider: 'square', environment: 'sandbox', accessToken: 'merchant-secret' });
  });

  it('rejects an injected business identifier instead of allowing a different tenant', async () => {
    const response = await request('/connections', { provider: 'square', environment: 'sandbox', accessToken: 'merchant-secret', businessId: 'business-b' });
    expect(response.status).toBe(400); expect(fixture.connect).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain('merchant-secret');
  });

  it('requires real Toast restaurant GUIDs and an explicit supported currency', async () => {
    const response = await request('/connections', { provider: 'toast', clientId: 'client', clientSecret: 'private-toast-secret', locationIds: ['not-a-guid'], currency: 'USD' });
    expect(response.status).toBe(400); expect(fixture.connect).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain('private-toast-secret');
  });

  it('rejects unsupported providers and date strings before invoking a preview', async () => {
    expect((await request('/connections/verona/preview', { startDate: '2026-09-01T00:00:00Z', endDate: '2026-09-02T00:00:00Z' })).status).toBe(400);
    expect((await request('/connections/square/preview', { startDate: 'yesterday', endDate: 'tomorrow' })).status).toBe(400);
    expect(fixture.preview).not.toHaveBeenCalled();
  });

  it('propagates retry guidance and sanitizes unexpected internal errors', async () => {
    fixture.list.mockRejectedValueOnce(new PosError('PROVIDER_RATE_LIMITED', 'Retry later.', 429, 25)).mockRejectedValueOnce(new Error('private-provider-secret'));
    const retry = await request('/connections'); expect(retry.status).toBe(429); expect(retry.headers.get('retry-after')).toBe('25');
    const error = await request('/connections'); expect(error.status).toBe(500); expect(JSON.stringify(await error.json())).not.toContain('private-provider-secret');
  });

  it('disconnects only the session business and validates provider names', async () => {
    expect((await request('/connections/toast', undefined, 'DELETE')).status).toBe(200);
    expect(fixture.disconnect).toHaveBeenCalledWith('business-a', 'toast');
    expect((await request('/connections/unknown', undefined, 'DELETE')).status).toBe(400);
  });
});
