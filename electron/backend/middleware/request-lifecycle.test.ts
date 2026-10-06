import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

const maintenance = vi.hoisted(() => ({ active: false }));
vi.mock('../database', () => ({ isDatabaseMaintenanceInProgress: () => maintenance.active }));
import { apiRequestLifecycle, managedRouter, waitForApiRequestsToDrain, waitForAllApiRequestsToDrain } from './request-lifecycle';

let server: Server | undefined;
const deferred = () => { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; };
afterEach(async () => {
  maintenance.active = false;
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); }
  await waitForAllApiRequestsToDrain(); server = undefined;
});
describe('approved managed router lifecycle', () => {
  it('holds a disconnected POS credential writer until its work finishes before restore begins', async () => {
    const entered = deferred(); const release = deferred(); const restoring = deferred(); let storedCredentials = false; let observedStoredCredentials = false;
    const app = express(); const router = managedRouter(); app.use(apiRequestLifecycle);
    router.post('/pos/connect', async (_req, res) => { entered.release(); await release.promise; storedCredentials = true; res.sendStatus(200); });
    router.post('/database/restore', async (_req, res) => { maintenance.active = true; restoring.release(); await waitForApiRequestsToDrain(); observedStoredCredentials = storedCredentials; maintenance.active = false; res.sendStatus(200); });
    app.use(router); server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server!.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const abort = new AbortController(); const writer = fetch(base + '/pos/connect', { method: 'POST', signal: abort.signal }).catch(() => null);
    await entered.promise; abort.abort(); await writer;
    const restore = fetch(base + '/database/restore', { method: 'POST' });
    const beganEarly = await Promise.race([restoring.promise.then(() => true), new Promise<boolean>(resolve => setTimeout(() => resolve(false), 25))]);
    expect(beganEarly).toBe(false); release.release(); expect((await restore).status).toBe(200); expect(observedStoredCredentials).toBe(true);
  });
  it('waits for a disconnected read handler during maintenance and rejects later reads', async () => {
    const entered = deferred(); const release = deferred(); const restoring = deferred(); let readFinished = false; let restoredAfterRead = false;
    const app = express(); const router = managedRouter(); app.use(apiRequestLifecycle);
    router.get('/read', async (_req, res) => { entered.release(); await release.promise; readFinished = true; res.sendStatus(200); });
    router.post('/restore', async (_req, res) => { maintenance.active = true; restoring.release(); await waitForApiRequestsToDrain(); restoredAfterRead = readFinished; res.sendStatus(200); });
    app.use(router); server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server!.once('listening', resolve));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const abort = new AbortController(); const read = fetch(base + '/read', { signal: abort.signal }).catch(() => null); await entered.promise; abort.abort(); await read;
    const restore = fetch(base + '/restore', { method: 'POST' }); await restoring.promise;
    expect((await fetch(base + '/read')).status).toBe(503); release.release(); expect((await restore).status).toBe(200); expect(restoredAfterRead).toBe(true);
  });
});
