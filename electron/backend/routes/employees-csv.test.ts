import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn() }));
vi.mock('../database', () => ({ getPrismaClient: () => ({ employee: { findFirst: fixture.find, create: fixture.create } }), isDatabaseMaintenanceInProgress: () => false }));
vi.mock('./auth', () => ({ protect: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('../../../lib/infrastructure/Logger', () => ({ logger: { error: vi.fn(), info: vi.fn() } }));
import employeeRoutes from './employees';
let server: Server | undefined;
beforeEach(() => { vi.clearAllMocks(); fixture.find.mockResolvedValue(null); fixture.create.mockImplementation(args => Promise.resolve({ id: 'employee-fixture', ...args.data })); });
afterEach(async () => { if (server) await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; });
async function send(csvData: unknown[]) {
  const app = express(); app.use(express.json()); app.use((req, _res, next) => { Object.assign(req, { user: { businessId: 'business-fixture' } }); next(); }); app.use('/employees', employeeRoutes);
  server = app.listen(0, '127.0.0.1'); if (!server.listening) await new Promise<void>(resolve => server!.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/employees/import-csv`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csvData }) });
  expect(response.status).toBe(200); return response.json();
}
const valid = { firstName: 'Ada', lastName: 'Tester', email: 'ada@example.test', hourlyRate: '20', role: 'server', tipEligible: false, startDate: '2020-01-15' };
describe('employee CSV server date contract', () => {
  it('persists explicit false eligibility and the supplied calendar hire date', async () => {
    expect((await send([valid])).imported).toBe(1);
    expect(fixture.create.mock.calls[0][0].data).toMatchObject({ tipEligible: false, startDate: new Date('2020-01-15T00:00:00Z') });
  });
  it('rejects missing, blank, ambiguous and impossible hire dates without inventing today', async () => {
    const { startDate: _ignored, ...missing } = valid;
    const result = await send([missing, { ...valid, startDate: '' }, { ...valid, startDate: '10/12/2020' }, { ...valid, startDate: '2020-02-30' }]);
    expect(result.imported).toBe(0); expect(result.errors).toHaveLength(4); expect(fixture.create).not.toHaveBeenCalled();
  });
  it('requires an explicit boolean instead of defaulting or treating false text as truthy', async () => {
    const { tipEligible: _ignored, ...missing } = valid;
    const result = await send([missing, { ...valid, tipEligible: 'false' }, { ...valid, tipEligible: 'yes' }]);
    expect(result.imported).toBe(0); expect(result.errors).toHaveLength(3); expect(fixture.create).not.toHaveBeenCalled();
  });
});
