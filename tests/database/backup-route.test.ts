import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import path from 'node:path';
import { once } from 'node:events';

const mocks = vi.hoisted(() => ({ createBackup: vi.fn() }));
vi.mock('../../electron/backend/database', () => ({ createDatabaseBackup: mocks.createBackup, getBackupsDirectory: () => '/not-used/backups', getDatabasePath: () => '/not-used/database.db', restoreDatabaseFromBackup: vi.fn(), listDatabaseBackups: vi.fn(), deleteDatabaseBackup: vi.fn() }));
vi.mock('../../electron/backend/database-health', () => ({ checkDatabaseHealth: vi.fn() }));
vi.mock('../../electron/backend/routes/auth', () => ({ protect: (_request: unknown, _response: unknown, next: () => void) => next() }));
vi.mock('../../electron/backend/middleware/request-lifecycle', async () => ({ managedRouter: () => express.Router() }));
vi.mock('../../lib/infrastructure/Logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
import databaseRouter from '../../electron/backend/routes/database';

let server: Server;
let url: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/database', databaseRouter);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}/database/backup`;
});
beforeEach(() => {
  mocks.createBackup.mockReset();
  // The valid route needs only file stats; this existing manifest is read-only.
  mocks.createBackup.mockResolvedValue(path.resolve('package.json'));
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

describe('backup HTTP filename validation', () => {
  it.each(['simple-label', 'snapshot.sqlite', '../outside.db', 'NUL.db', 'snapshot..db'])('rejects %s before invoking storage', async customName => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customName }) });
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain('.db filename');
    expect(mocks.createBackup).not.toHaveBeenCalled();
  });
  it('accepts a safe .db filename', async () => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customName: 'before-payroll.db' }) });
    expect(response.status).toBe(200);
    expect(mocks.createBackup).toHaveBeenCalledWith('before-payroll.db');
  });
});
