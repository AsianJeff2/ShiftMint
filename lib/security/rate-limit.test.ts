import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { authRateLimiter, apiRateLimiter, createRateLimiter } from './rate-limit';

let server: Server | undefined;
async function post(app: express.Express, body: unknown) {
  if (!server) server = app.listen(0, '127.0.0.1');
  if (!server.listening) await new Promise<void>(resolve => server!.once('listening', resolve));
  return fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
afterEach(async () => { if (server) await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; vi.unstubAllEnvs(); });
describe('shared terminal rate limits', () => {
  it('does not count successful sign-ins as failed attempts', async () => {
    const app = express(); app.use(express.json(), authRateLimiter); app.post('/login', (_req, res) => res.json({ success: true }));
    for (let index = 0; index < 7; index++) expect((await post(app, { email: 'successful@example.test' })).status).toBe(200);
  });
  it('limits failed attempts by normalized identifier without blocking another account on the same terminal', async () => {
    const app = express(); app.use(express.json(), authRateLimiter); app.post('/login', (_req, res) => res.status(401).json({ success: false }));
    for (let index = 0; index < 5; index++) expect((await post(app, { email: ' Failed@example.test ' })).status).toBe(401);
    expect((await post(app, { email: 'failed@EXAMPLE.test' })).status).toBe(429);
    expect((await post(app, { email: 'another@example.test' })).status).toBe(401);
  });
  it('separates authenticated users behind one address', async () => {
    const app = express(); app.use(express.json(), (req, _res, next) => { Object.assign(req, { user: { userId: req.body.userId } }); next(); }, createRateLimiter({ windowMs: 60000, max: 1 })); app.post('/login', (_req, res) => res.json({ success: true }));
    expect((await post(app, { userId: 'one' })).status).toBe(200);
    expect((await post(app, { userId: 'one' })).status).toBe(429);
    expect((await post(app, { userId: 'two' })).status).toBe(200);
  });
  it('allows authenticated trusted desktop polling above the hosted API limit', async () => {
    vi.stubEnv('SHIFTMINT_RUNTIME', 'desktop');
    const app = express(); app.use((req, _res, next) => { Object.assign(req, { user: { userId: 'desktop' } }); next(); }, apiRateLimiter); app.post('/login', (_req, res) => res.json({ success: true }));
    for (let index = 0; index < 105; index++) expect((await post(app, {})).status).toBe(200);
  });
});
