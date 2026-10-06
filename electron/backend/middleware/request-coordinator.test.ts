import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { createRequestCoordinator } from './request-coordinator';

const servers: Server[] = [];
const deferred = () => { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; };
async function fixture(waitMs = 1000) {
  let maintenance = false;
  const coordinator = createRequestCoordinator(() => maintenance, waitMs);
  const app = express();
  app.use(coordinator.middleware);
  const server = app.listen(0, '127.0.0.1'); servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return { app, coordinator, setMaintenance: (value: boolean) => { maintenance = value; }, get: (path: string) => fetch(base + path), post: (path: string, signal?: AbortSignal) => fetch(base + path, { method: 'POST', signal }) };
}
afterEach(async () => { for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } });
describe('isolated mutation coordinator proposal', () => {
  it('serializes clock-in checks and writes so only one shift can be created', async () => {
    const f = await fixture(); const entered = deferred(); const release = deferred(); let shifts = 0;
    f.app.post('/clock-in', f.coordinator.track(async (_req, res) => { if (shifts) { res.sendStatus(409); return; } entered.release(); await release.promise; shifts++; res.sendStatus(201); }));
    const first = f.post('/clock-in'); await entered.promise; const second = f.post('/clock-in'); release.release();
    expect((await first).status).toBe(201); expect((await second).status).toBe(409); expect(shifts).toBe(1);
  });
  it('makes a source edit see the period closed by a preceding calculation', async () => {
    const f = await fixture(); const entered = deferred(); const release = deferred(); let closed = false; let edits = 0;
    f.app.post('/calculate', f.coordinator.track(async (_req, res) => { entered.release(); await release.promise; closed = true; res.sendStatus(200); }));
    f.app.post('/edit', f.coordinator.track(async (_req, res) => { if (closed) res.sendStatus(409); else { edits++; res.sendStatus(200); } }));
    const calculate = f.post('/calculate'); await entered.promise; const edit = f.post('/edit'); release.release(); await calculate;
    expect((await edit).status).toBe(409); expect(edits).toBe(0);
  });
  it('does not release an aborted writer until its asynchronous work finishes', async () => {
    const f = await fixture(); const entered = deferred(); const release = deferred(); let completed = false; let observed = false;
    f.app.post('/write', f.coordinator.track(async (_req, res) => { entered.release(); await release.promise; completed = true; res.sendStatus(200); }));
    f.app.post('/next', f.coordinator.track(async (_req, res) => { observed = completed; res.sendStatus(200); }));
    const controller = new AbortController(); const writer = f.post('/write', controller.signal).catch(() => null); await entered.promise; controller.abort(); await writer;
    const next = f.post('/next'); release.release(); await next; expect(observed).toBe(true);
  });
  it('rejects queued writes when maintenance begins and drains reads without a queue deadlock', async () => {
    const f = await fixture(); const entered = deferred(); const release = deferred(); const restoring = deferred(); let writes = 0;
    f.app.get('/read', f.coordinator.track(async (_req, res) => { entered.release(); await release.promise; res.sendStatus(200); }));
    f.app.post('/restore', f.coordinator.track(async (_req, res) => { f.setMaintenance(true); restoring.release(); await f.coordinator.drain(); res.sendStatus(200); }));
    f.app.post('/write', f.coordinator.track(async (_req, res) => { writes++; res.sendStatus(200); }));
    const read = f.get('/read'); await entered.promise; const restore = f.post('/restore'); await restoring.promise; const write = f.post('/write'); release.release(); await read;
    expect((await restore).status).toBe(200); expect((await write).status).toBe(503); expect(writes).toBe(0);
  });
  it('times out a queued client without letting later writers pass an active writer', async () => {
    const f = await fixture(30); const entered = deferred(); const release = deferred(); let writes = 0;
    f.app.post('/held', f.coordinator.track(async (_req, res) => { entered.release(); await release.promise; res.sendStatus(200); }));
    f.app.post('/write', f.coordinator.track(async (_req, res) => { writes++; res.sendStatus(200); }));
    const held = f.post('/held'); await entered.promise; expect((await f.post('/write')).status).toBe(503); expect(writes).toBe(0); release.release(); await held;
    expect((await f.post('/write')).status).toBe(200); expect(writes).toBe(1);
  });
});
