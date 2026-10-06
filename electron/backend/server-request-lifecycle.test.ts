import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';

const fixture = vi.hoisted(() => {
  const deferred = () => { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; };
  const model = () => ({ findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn() });
  return {
    deferred, middlewareEntered: deferred(), middlewareRelease: deferred(), responseClosed: deferred(),
    firstWriteEntered: deferred(), firstWriteRelease: deferred(), secondWriteEntered: deferred(),
    firstWriteComplete: false, secondSawCompletedWrite: false, maintenance: false, replacementStarted: false, writeOverlappedReplacement: false,
    db: { user: model(), appSetting: model(), business: model(), employee: model(), shift: model(),
      punchEvent: model(), payrollPeriod: model(), businessConfiguration: model() },
  };
});
vi.mock('./database', () => ({
  getPrismaClient: () => fixture.db, registerDatabaseMaintenanceDrain: vi.fn(),
  isDatabaseMaintenanceInProgress: () => fixture.maintenance,
  createDatabaseBackup: vi.fn(), restoreDatabaseFromBackup: vi.fn(), deleteDatabaseBackup: vi.fn(),
  getDatabasePath: vi.fn(), getBackupsDirectory: vi.fn(), listDatabaseBackups: vi.fn(),
}));
vi.mock('../../lib/infrastructure/Logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../lib/infrastructure/ConfigurationService', () => ({ config: { get: () => 'request-lifecycle-fixture-key', isTest: () => true } }));
vi.mock('./services/analytics-scheduler', () => ({ scheduleAnalyticsCollection: vi.fn(), stopAnalyticsCollection: vi.fn() }));
vi.mock('../../lib/security/rate-limit', async importOriginal => {
  const original = await importOriginal<typeof import('../../lib/security/rate-limit')>();
  const { default: rateLimit } = await import('express-rate-limit');
  return {
    ...original,
    apiRateLimiter: rateLimit({
      windowMs: 60000, limit: 100,
      skip: async (req, res) => {
        if (req.body?.employeeId === 'employee-first') {
          res.once('close', fixture.responseClosed.release);
          fixture.middlewareEntered.release();
          await fixture.middlewareRelease.promise;
        }
        return false;
      },
    }),
  };
});
import app from './server';
import { waitForAllApiRequestsToDrain } from './middleware/request-lifecycle';

let server: Server | undefined;
let base: string;
const observedBeforeRelease = (promise: Promise<unknown>) => Promise.race([
  promise.then(() => true), new Promise<boolean>(resolve => setTimeout(() => resolve(false), 40)),
]);
const token = jwt.sign({ userId: 'fixture-owner', credentialVersion: createHash('sha256').update('fixture-password-hash').digest('hex') }, 'request-lifecycle-fixture-key');

beforeEach(async () => {
  vi.stubEnv('SHIFTMINT_RUNTIME', 'web');
  fixture.middlewareEntered = fixture.deferred(); fixture.middlewareRelease = fixture.deferred(); fixture.responseClosed = fixture.deferred();
  fixture.firstWriteEntered = fixture.deferred(); fixture.firstWriteRelease = fixture.deferred(); fixture.secondWriteEntered = fixture.deferred();
  fixture.firstWriteComplete = false; fixture.secondSawCompletedWrite = false;
  fixture.maintenance = false; fixture.replacementStarted = false; fixture.writeOverlappedReplacement = false;
  fixture.db.user.findUnique.mockResolvedValue({ id: 'fixture-owner', passwordHash: 'fixture-password-hash', email: 'fixture@example.invalid', role: 'owner', businessId: 'business-fixture' });
  fixture.db.appSetting.findUnique.mockResolvedValue(null);
  fixture.db.business.findFirst.mockResolvedValue({ id: 'business-fixture' });
  fixture.db.businessConfiguration.findUnique.mockResolvedValue(null);
  fixture.db.payrollPeriod.findMany.mockResolvedValue([]);
  fixture.db.employee.findFirst.mockImplementation(args => Promise.resolve({ id: args.where.id, hourlyRate: 20 }));
  fixture.db.shift.findFirst.mockResolvedValue(null);
  fixture.db.shift.create.mockImplementation(async args => {
    if (args.data.employeeId === 'employee-first') {
      fixture.writeOverlappedReplacement ||= fixture.replacementStarted;
      fixture.firstWriteEntered.release();
      await fixture.firstWriteRelease.promise;
      fixture.firstWriteComplete = true;
    } else {
      fixture.secondSawCompletedWrite = fixture.firstWriteComplete;
      fixture.secondWriteEntered.release();
    }
    return { id: `shift-${args.data.employeeId}`, ...args.data };
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server!.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

afterEach(async () => {
  fixture.middlewareRelease.release(); fixture.firstWriteRelease.release(); fixture.maintenance = false;
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); }
  await waitForAllApiRequestsToDrain(); server = undefined;
  vi.unstubAllEnvs(); vi.clearAllMocks();
});

function clockIn(employeeId: string, signal?: AbortSignal) {
  return fetch(base + '/api/shifts/clock-in', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ employeeId }),
  });
}
async function disconnectDuringMiddleware() {
  const abort = new AbortController();
  const request = clockIn('employee-first', abort.signal).catch(() => null);
  await fixture.middlewareEntered.promise; abort.abort(); await request; await fixture.responseClosed.promise;
}

describe('server API middleware lifetime after disconnect', () => {
  it('keeps the next writer queued through delayed middleware and the later clock-in write', async () => {
    await disconnectDuringMiddleware();
    const second = clockIn('employee-second');
    const secondBeganDuringMiddleware = await observedBeforeRelease(fixture.secondWriteEntered.promise);
    fixture.middlewareRelease.release(); await fixture.firstWriteEntered.promise;
    const secondBeganDuringWrite = await observedBeforeRelease(fixture.secondWriteEntered.promise);
    fixture.firstWriteRelease.release();
    expect((await second).status).toBe(201);
    await waitForAllApiRequestsToDrain();

    expect(secondBeganDuringMiddleware).toBe(false);
    expect(secondBeganDuringWrite).toBe(false);
    expect(fixture.secondSawCompletedWrite).toBe(true);
  });

  it('keeps maintenance drain pending through delayed middleware and the later clock-in write', async () => {
    await disconnectDuringMiddleware(); fixture.maintenance = true;
    const drain = waitForAllApiRequestsToDrain().then(() => { fixture.replacementStarted = true; });
    const drainedDuringMiddleware = await observedBeforeRelease(drain);
    fixture.middlewareRelease.release(); await fixture.firstWriteEntered.promise;
    const drainedDuringWrite = await observedBeforeRelease(drain);
    fixture.firstWriteRelease.release(); await drain;

    expect(drainedDuringMiddleware).toBe(false);
    expect(drainedDuringWrite).toBe(false);
    expect(fixture.firstWriteComplete).toBe(true);
    expect(fixture.writeOverlappedReplacement).toBe(false);
  });
});
