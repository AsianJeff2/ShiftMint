import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { request as httpRequest } from 'node:http';
import { resolve } from 'node:path';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { toPayrollPeriodDTO } from '../../lib/transformers/payrollTransformer';
import { toEmployeeDTO } from '../../lib/transformers/employeeDTO';
import { toShiftDTO } from '../../lib/transformers/shiftTransformer';
import { defaultTipDistributionSettings } from '../../lib/tip-distribution';
import { apiRateLimiter } from '../../lib/security/rate-limit';

const fixture = vi.hoisted(() => {
  const model = () => ({
    findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(),
    create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(),
    aggregate: vi.fn(), groupBy: vi.fn(),
  });
  const db = {
    user: model(), business: model(), businessConfiguration: model(), employee: model(),
    shift: model(), tipEntry: model(), payrollPeriod: model(), payrollEntry: model(),
    appSetting: model(), punchEvent: model(), tipAuditLog: model(),
    $transaction: vi.fn(),
  };
  return { db, backup: vi.fn(), restore: vi.fn(), deleteBackup: vi.fn(), maintenance: false };
});

vi.mock('./database', () => ({
  getPrismaClient: () => fixture.db,
  createDatabaseBackup: fixture.backup,
  restoreDatabaseFromBackup: fixture.restore,
  deleteDatabaseBackup: fixture.deleteBackup,
  getDatabasePath: () => '/fixture/shiftmint.db',
  getBackupsDirectory: () => '/fixture/backups',
  listDatabaseBackups: () => [],
  isDatabaseMaintenanceInProgress: () => fixture.maintenance,
  registerDatabaseMaintenanceDrain: vi.fn(),
}));
vi.mock('../../lib/infrastructure/ConfigurationService', () => ({
  config: { get: (key: string) => key === 'jwtSecret' ? 'unit-test-signing-key' : 'test', isTest: () => true },
}));
vi.mock('./services/analytics-scheduler', () => ({ scheduleAnalyticsCollection: vi.fn(), stopAnalyticsCollection: vi.fn() }));
import app, { parseTrustProxy, startBackendServer } from './server';

let server: Server | undefined;
async function request(endpoint: string, body?: unknown, authenticated = true, role = 'owner', method?: string, extraHeaders: Record<string, string> = {}, version = 'fixture-password-hash') {
  fixture.db.user.findUnique.mockResolvedValue({
    id: 'user-a', email: 'owner@example.test', role, businessId: 'business-a',
    firstName: 'Taylor', lastName: 'Vale',
    passwordHash: 'fixture-password-hash',
  });
  if (!server) server = app.listen(0, '127.0.0.1');
  if (!server.listening) await new Promise<void>(resolve => server!.once('listening', resolve));
  const address = server.address() as { port: number };
  const options = {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: {
      'Content-Type': 'application/json',
      ...(body !== undefined ? { 'Content-Length': Buffer.byteLength(JSON.stringify(body)).toString() } : {}),
      ...(authenticated ? { Authorization: `Bearer ${jwt.sign({ userId: 'user-a', credentialVersion: createHash('sha256').update(version).digest('hex') }, 'unit-test-signing-key')}` } : {}),
      ...extraHeaders,
    },
  };
  return new Promise<Response>((resolve, reject) => {
    const incoming = httpRequest(`http://127.0.0.1:${address.port}/api${endpoint}`, options, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(Buffer.from(chunk)));
      response.on('end', () => resolve(new Response(Buffer.concat(chunks).toString(), { status: response.statusCode || 500 })));
    });
    incoming.on('error', reject);
    incoming.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  apiRateLimiter.resetKey('127.0.0.1:user-a');
  vi.stubEnv('SHIFTMINT_RUNTIME', 'web');
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-20T12:00Z'));
  fixture.maintenance = false;
  fixture.db.$transaction.mockImplementation(callback => callback(fixture.db));
  fixture.db.shift.findMany.mockResolvedValue([]);
  fixture.db.tipEntry.findMany.mockResolvedValue([]);
  fixture.db.employee.findMany.mockResolvedValue([]);
  fixture.db.business.findFirst.mockResolvedValue({ id: 'business-a' });
  fixture.db.business.findUnique.mockResolvedValue({ id: 'business-a' });
  fixture.db.payrollPeriod.findMany.mockResolvedValue([]);
});
afterEach(async () => {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  server = undefined;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
  app.set('trust proxy', false);
});

describe('API security boundaries', () => {
  it('resnapshots reassigned shift wages while preserving explicit rates and notes-only edits', async () => {
    const shift = { id: 'shift-a', businessId: 'business-a', employeeId: 'employee-a', startTime: new Date('2026-10-05T12:00Z'), endTime: new Date('2026-10-05T16:00Z'), status: 'completed', hourlyRate: 20 };
    fixture.db.shift.findFirst.mockResolvedValue(shift);
    fixture.db.employee.findFirst.mockResolvedValue({ id: 'employee-b', businessId: 'business-a', hourlyRate: 35 });
    fixture.db.shift.update.mockImplementation(args => Promise.resolve({ ...shift, ...args.data }));
    expect((await request('/shifts/shift-a', { employeeId: 'employee-b' }, true, 'owner', 'PUT')).status).toBe(200);
    expect(fixture.db.shift.update.mock.lastCall[0].data).toMatchObject({ employeeId: 'employee-b', hourlyRate: 35 });
    expect((await request('/shifts/shift-a', { employeeId: 'employee-b', hourlyRate: 30 }, true, 'owner', 'PUT')).status).toBe(200);
    expect(fixture.db.shift.update.mock.lastCall[0].data.hourlyRate).toBe(30);
    expect((await request('/shifts/shift-a', { notes: 'corrected' }, true, 'owner', 'PUT')).status).toBe(200);
    expect(fixture.db.shift.update.mock.lastCall[0].data).not.toHaveProperty('hourlyRate');
  });
  it('rejects offsetless shift and tip writes and imports before persistence', async () => {
    const ambiguous = '2026-10-05T18:00:00';
    expect((await request('/shifts', { startTime: ambiguous })).status).toBe(400);
    expect((await request('/shifts/shift-a', { startTime: ambiguous }, true, 'owner', 'PUT')).status).toBe(400);
    expect((await request('/tips', { amount: 20, timestamp: ambiguous })).status).toBe(400);
    expect((await request('/tips/tip-a', { timestamp: ambiguous }, true, 'owner', 'PUT')).status).toBe(400);
    fixture.db.employee.findMany.mockResolvedValue([{ id: 'employee-a', firstName: 'Taylor', lastName: 'Vale', hourlyRate: 20 }]);
    const shiftImport = await request('/shifts/import-csv', { csvData: [{ employeeId: 'employee-a', startTime: ambiguous }] });
    const tipImport = await request('/tips/import-csv', { csvData: [{ amount: 20, timestamp: ambiguous }] });
    expect((await shiftImport.json()).imported).toBe(0);
    expect((await tipImport.json()).imported).toBe(0);
    expect(fixture.db.shift.create).not.toHaveBeenCalled();
    expect(fixture.db.tipEntry.create).not.toHaveBeenCalled();
  });
  it('assigns CSV shift calendar days in the venue timezone', async () => {
    fixture.db.businessConfiguration.findUnique.mockResolvedValue({ timeZone: 'America/Los_Angeles' });
    fixture.db.employee.findMany.mockResolvedValue([{ id: 'employee-a', hourlyRate: 20 }]);
    fixture.db.shift.create.mockImplementation(args => Promise.resolve({ id: 'shift-a', ...args.data }));
    const response = await request('/shifts/import-csv', { csvData: [{ employeeId: 'employee-a', startTime: '2026-10-06T06:00Z', endTime: '2026-10-06T07:00Z' }] });
    expect((await response.json()).imported).toBe(1);
    expect(fixture.db.shift.create.mock.lastCall[0].data.shiftDate).toBe('2026-10-05');
  });
  it('blocks payroll closure when earlier workweek context still needs review', async () => {
    fixture.db.businessConfiguration.findUnique.mockResolvedValue({ timeZone: 'America/Los_Angeles', payPeriodStartDay: 1 });
    fixture.db.payrollPeriod.findFirst.mockResolvedValue({ id: 'period-a', businessId: 'business-a', status: 'open', startDate: new Date('2026-10-07'), endDate: new Date('2026-10-09'), payrollEntries: [] });
    fixture.db.employee.findMany.mockResolvedValue([{ id: 'employee-a', hourlyRate: 20 }]);
    fixture.db.shift.findMany.mockResolvedValue([{ id: 'context-a', employeeId: 'employee-a', startTime: new Date('2026-10-05T16:00Z'), endTime: new Date('2026-10-05T20:00Z'), status: 'pending_review' }]);
    const response = await request('/payroll/periods/period-a/calculate', {});
    expect(response.status).toBe(422);
    expect((await response.json()).shiftIds).toEqual(['context-a']);
    expect(fixture.db.payrollEntry.upsert).not.toHaveBeenCalled();
    expect(fixture.db.payrollPeriod.update).not.toHaveBeenCalled();
  });
  it('allows admin read-only tip distribution preview without settings write access', async () => {
    fixture.db.payrollPeriod.findFirst.mockResolvedValue({ id: 'period-a', startDate: new Date('2026-10-05'), endDate: new Date('2026-10-06') });
    expect((await request('/tip-distribution/calculate', { periodId: 'period-a', settings: defaultTipDistributionSettings() }, true, 'admin')).status).toBe(200);
    expect((await request('/tip-distribution/settings', defaultTipDistributionSettings(), true, 'admin')).status).toBe(403);
  });
  it('rejects mismatched effective tip employees on owned linked shifts before create or update', async () => {
    fixture.db.tipEntry.create.mockImplementation(args => Promise.resolve({ id: 'tip-a', ...args.data }));
    fixture.db.tipEntry.update.mockImplementation(args => Promise.resolve({ id: 'tip-a', ...args.data }));
    fixture.db.employee.findFirst.mockResolvedValue({ id: 'employee-b', businessId: 'business-a' });
    fixture.db.shift.findFirst.mockResolvedValue({ id: 'shift-a', businessId: 'business-a', employeeId: 'employee-a' });
    expect((await request('/tips', { amount: 10, employeeId: 'employee-b', shiftId: 'shift-a', timestamp: '2025-01-01T12:00Z' })).status).toBe(400);
    fixture.db.tipEntry.findFirst.mockResolvedValue({ id: 'tip-a', employeeId: 'employee-a', shiftId: 'shift-a', timestamp: new Date('2025-01-01T12:00Z') });
    expect((await request('/tips/tip-a', { employeeId: 'employee-b' }, true, 'owner', 'PUT')).status).toBe(400);
    fixture.db.tipEntry.findFirst.mockResolvedValue({ id: 'tip-a', employeeId: 'employee-b', shiftId: null, timestamp: new Date('2025-01-01T12:00Z') });
    expect((await request('/tips/tip-a', { shiftId: 'shift-a' }, true, 'owner', 'PUT')).status).toBe(400);
    expect(fixture.db.tipEntry.create).not.toHaveBeenCalled(); expect(fixture.db.tipEntry.update).not.toHaveBeenCalled();
  });
  it('allows matching or shared shift attribution without introducing timestamp interval policy', async () => {
    fixture.db.employee.findFirst.mockResolvedValue({ id: 'employee-a', businessId: 'business-a' });
    fixture.db.tipEntry.create.mockImplementation(args => Promise.resolve({ id: 'tip-a', ...args.data }));
    fixture.db.shift.findFirst.mockResolvedValue({ id: 'shift-a', businessId: 'business-a', employeeId: 'employee-a', endTime: new Date('2024-01-01') });
    expect((await request('/tips', { amount: 10, employeeId: 'employee-a', shiftId: 'shift-a', timestamp: '2025-01-01T12:00Z' })).status).toBe(201);
    fixture.db.shift.findFirst.mockResolvedValue({ id: 'shared', businessId: 'business-a', employeeId: null });
    expect((await request('/tips', { amount: 10, employeeId: 'employee-a', shiftId: 'shared' })).status).toBe(201);
  });
  it('rejects incompatible business String fields and invalid configuration values before writes', async () => {
    expect((await request('/business', { address: { street: 'fixture' } }, true, 'owner', 'PUT')).status).toBe(400);
    for (const body of [{ timeZone: '' }, { payPeriodFrequency: 2 }, { tipOutMethod: {} }]) expect((await request('/business/configuration', body, true, 'owner', 'PUT')).status).toBe(400);
    expect(fixture.db.business.update).not.toHaveBeenCalled(); expect(fixture.db.businessConfiguration.upsert).not.toHaveBeenCalled();
  });
  it('groups typed tip analytics in the selected venue calendar range without raw SQLite timestamp coercion', async () => {
    fixture.db.businessConfiguration.findUnique.mockResolvedValue({ timeZone: 'America/Los_Angeles' });
    fixture.db.tipEntry.aggregate.mockResolvedValue({ _sum: { amount: 10 }, _avg: { amount: 5 }, _count: 2 });
    fixture.db.tipEntry.groupBy.mockResolvedValue([]);
    fixture.db.tipEntry.findMany.mockResolvedValue([{ timestamp: new Date('2025-01-02T06:00Z'), amount: 10 }]);
    const response = await request('/tips/analytics/dashboard?startDate=2025-01-01&endDate=2025-01-01');
    expect(response.status).toBe(200); const data = (await response.json()).data;
    expect(data.dailyTrends).toEqual([{ date: '2025-01-01', count: 1, total: 10, average: 10 }]);
    expect(fixture.db.tipEntry.findMany.mock.lastCall[0].where).toMatchObject({ businessId: 'business-a', complianceStatus: { not: 'voided' }, timestamp: { gte: new Date('2025-01-01T08:00Z'), lt: new Date('2025-01-02T08:00Z') } });
  });
  it('exports calendar overlap with longstanding employees, clipped work hours and estimate metadata', async () => {
    fixture.db.businessConfiguration.findUnique.mockResolvedValue({ timeZone: 'America/Los_Angeles' });
    fixture.db.employee.findMany.mockResolvedValue([{ id: 'employee-a', createdAt: new Date('2020-01-01'), bankAccountNumber: 'fixture-bank' }]);
    fixture.db.shift.findMany.mockResolvedValue([{ id: 'shift-a', startTime: new Date('2025-01-01T07:00Z'), endTime: new Date('2025-01-01T09:00Z'), status: 'completed' }]);
    fixture.db.payrollPeriod.findMany.mockResolvedValue([{ id: 'period-a', startDate: new Date('2024-12-30'), endDate: new Date('2025-01-05'), payrollEntries: [{ grossPay: 40, netPay: 30, totalTaxes: 10 }] }]);
    const response = await request('/export', { type: 'comprehensive', format: 'json', startDate: '2025-01-01', endDate: '2025-01-01' });
    expect(response.status).toBe(200); const body = await response.json();
    expect(fixture.db.employee.findMany.mock.lastCall[0].where).toEqual({ businessId: 'business-a' });
    expect(fixture.db.shift.findMany.mock.lastCall[0].where).toMatchObject({ startTime: { lt: new Date('2025-01-02T08:00Z') }, OR: [{ endTime: { gt: new Date('2025-01-01T08:00Z') } }, { endTime: null }] });
    expect(fixture.db.payrollPeriod.findMany.mock.lastCall[0].where).toMatchObject({ startDate: { lte: new Date('2025-01-01') }, endDate: { gte: new Date('2025-01-01') } });
    expect(body.data[0].summary.totalHours).toBe(1); expect(body.taxTreatment).toBe('estimate'); expect(body.warnings.join(' ')).toContain('overlapping');
  });
  it('honors unchecked comprehensive sections without nested PII or tip details and rejects invalid export dates', async () => {
    fixture.db.shift.findMany.mockResolvedValue([{ id: 'shift-a', startTime: new Date('2025-01-01T12:00Z'), endTime: new Date('2025-01-01T14:00Z'), status: 'completed', notes: 'private contact', serverName: 'private name', tipEntries: [{ serverName: 'private name' }] }]);
    const response = await request('/export', { type: 'comprehensive', format: 'json', options: { includeEmployeeDetails: false, includeTipBreakdown: false, includePayrollCalculations: false } });
    expect(response.status).toBe(200); const body = await response.json();
    for (const key of ['employees', 'tips', 'payrollPeriods']) expect(body.data[0]).not.toHaveProperty(key);
    expect(JSON.stringify(body)).not.toContain('private'); expect(body.data[0].shifts[0]).not.toHaveProperty('tipEntries');
    expect(fixture.db.employee.findMany).not.toHaveBeenCalled(); expect(fixture.db.payrollPeriod.findMany).not.toHaveBeenCalled();
    expect((await request('/export', { type: 'comprehensive', format: 'json', startDate: '2025-02-30' })).status).toBe(400);
  });
  it('requires the ephemeral desktop capability even for null-origin auth requests', async () => {
    vi.stubEnv('SHIFTMINT_RUNTIME', 'desktop'); vi.stubEnv('SHIFTMINT_DESKTOP_TOKEN', 'fixture-desktop-capability-32-characters');
    expect((await request('/auth/status', undefined, false, 'owner', undefined, { Origin: 'null' })).status).toBe(403);
    expect((await request('/auth/status', undefined, false, 'owner', undefined, { Origin: 'null', 'X-Desktop-Token': 'wrong' })).status).toBe(403);
    expect(fixture.db.user.count).not.toHaveBeenCalled();
    fixture.db.user.count.mockResolvedValue(1); fixture.db.business.count.mockResolvedValue(1);
    expect((await request('/auth/status', undefined, false, 'owner', undefined, { Origin: 'null', 'X-Desktop-Token': process.env.SHIFTMINT_DESKTOP_TOKEN! })).status).toBe(200);
    vi.stubEnv('SHIFTMINT_DESKTOP_TOKEN', '');
    expect((await request('/auth/status', undefined, false)).status).toBe(503);
    expect((await request('/health', undefined, false)).status).toBe(200);
  });
  it('includes ended active work intervals in distribution and rejects overlap with actionable source IDs', async () => {
    fixture.db.payrollPeriod.findFirst.mockResolvedValue({ startDate: new Date('2025-01-01'), endDate: new Date('2025-01-01') });
    fixture.db.employee.findMany.mockResolvedValue([{ id: 'employee-a', firstName: 'Taylor', lastName: 'Vale', hourlyRate: 20, role: 'server' }]);
    fixture.db.tipEntry.findMany.mockResolvedValue([{ amount: 10 }]);
    const shift = { id: 'shift-a', employeeId: 'employee-a', startTime: new Date('2025-01-01T12:00Z'), endTime: new Date('2025-01-01T14:00Z'), status: 'active' };
    fixture.db.shift.findMany.mockImplementation(args => Promise.resolve(args.where.status === 'completed' ? [] : [shift]));
    const response = await request('/tip-distribution/calculate', { periodId: 'period-a', settings: defaultTipDistributionSettings() });
    expect(response.status).toBe(200); expect((await response.json()).distribution).toMatchObject([{ tipAmount: 8, hours: 2 }]);
    fixture.db.shift.findMany.mockResolvedValue([shift, { ...shift, id: 'shift-b' }]);
    const invalid = await request('/tip-distribution/calculate', { periodId: 'period-a', settings: defaultTipDistributionSettings() });
    expect(invalid.status).toBe(422); expect((await invalid.json()).shiftIds).toEqual(['shift-a', 'shift-b']);
  });
  it('returns client-compatible employee shift totals and isolates source errors by employee', async () => {
    const marker = new Date('2025-01-01');
    const employee = { id: 'employee-a', businessId: 'business-a', firstName: 'Taylor', lastName: 'Vale', hourlyRate: 20, startDate: marker, createdAt: marker, updatedAt: marker, bankAccountNumber: 'fixture-bank' };
    const shift = { id: 'shift-a', employeeId: 'employee-a', businessId: 'business-a', startTime: new Date('2025-01-01T12:00Z'), endTime: new Date('2025-01-01T14:00Z'), status: 'active', createdAt: marker, updatedAt: marker };
    fixture.db.employee.findMany.mockResolvedValue([employee, { ...employee, id: 'employee-b' }]);
    fixture.db.shift.findMany.mockResolvedValue([shift, { ...shift, id: 'bad-a', employeeId: 'employee-b' }, { ...shift, id: 'bad-b', employeeId: 'employee-b' }]);
    const response = await request('/shifts/by-employee?startDate=2025-01-01&endDate=2025-01-01');
    expect(response.status).toBe(200); const body = await response.json();
    expect(body.complete).toBe(false); expect(body.issues).toMatchObject([{ employeeId: 'employee-b', shiftIds: ['bad-a', 'bad-b'] }]);
    expect(body.data[0]).toMatchObject({ totalHours: 2, totalWages: 40 });
    expect(toEmployeeDTO(body.data[0].employee).startDate).toBe('2025-01-01');
    expect(toShiftDTO(body.data[0].shifts[0]).totalWage).toBe(40);
    expect(body.data[0].employee).not.toHaveProperty('bankAccountNumber');
  });
  it('rejects invalid filter and pagination inputs before source queries', async () => {
    expect((await request('/shifts?limit=wat')).status).toBe(400);
    expect((await request('/shifts?startDate=2025-02-30')).status).toBe(400);
    expect(fixture.db.shift.findMany).not.toHaveBeenCalled();
  });
  it('denies staff contact and wage rosters consistently', async () => {
    expect((await request('/employees', undefined, true, 'staff')).status).toBe(403);
    expect((await request('/shifts', undefined, true, 'staff')).status).toBe(403);
    expect(fixture.db.employee.findMany).not.toHaveBeenCalled();
    expect(fixture.db.shift.findMany).not.toHaveBeenCalled();
  });
  it('rejects absent employee identity during tip shift validation before querying', async () => {
    fixture.db.employee.findFirst.mockResolvedValue({ id: 'unrelated' });
    fixture.db.shift.findFirst.mockResolvedValue({ id: 'unrelated' });
    expect((await request('/tips/validate-shift', { date: '2026-10-05' })).status).toBe(400);
    expect(fixture.db.employee.findFirst).not.toHaveBeenCalled();
  });
  it('requires owner and typed confirmation before bulk deletion and records an audit marker', async () => {
    fixture.db.payrollPeriod.count.mockResolvedValue(0);
    fixture.db.shift.count.mockResolvedValue(2);
    fixture.db.shift.deleteMany.mockResolvedValue({ count: 2 });
    expect((await request('/shifts/all/confirm', {}, true, 'manager', 'DELETE')).status).toBe(403);
    expect((await request('/shifts/all/confirm', {}, true, 'owner', 'DELETE')).status).toBe(400);
    expect(fixture.db.shift.deleteMany).not.toHaveBeenCalled();
    expect((await request('/shifts/all/confirm', { confirmation: 'DELETE ALL SHIFTS' }, true, 'owner', 'DELETE')).status).toBe(200);
    expect(fixture.db.appSetting.create.mock.lastCall[0].data).toMatchObject({ key: expect.stringContaining('audit.shift.bulk.'), value: expect.stringContaining('user-a') });
  });
  it('requires calculation to close a period and prevents future-period closure', async () => {
    fixture.db.payrollPeriod.findFirst.mockResolvedValue({ id: 'period-a', businessId: 'business-a', status: 'open', startDate: new Date('2099-01-01'), endDate: new Date('2099-01-07'), payrollEntries: [] });
    expect((await request('/payroll/periods/period-a', { status: 'closed' }, true, 'owner', 'PUT')).status).toBe(422);
    expect((await request('/payroll/periods/period-a/calculate', {})).status).toBe(422);
    expect(fixture.db.payrollPeriod.update).not.toHaveBeenCalled();
  });
  it('returns actionable shift IDs for overlapping payroll input without saving entries', async () => {
    fixture.db.payrollPeriod.findFirst.mockResolvedValue({ id: 'period-a', businessId: 'business-a', status: 'open', startDate: new Date('2025-01-01'), endDate: new Date('2025-01-01'), payrollEntries: [] });
    fixture.db.employee.findMany.mockResolvedValue([{ id: 'employee-a', hourlyRate: 20 }]);
    fixture.db.shift.findMany.mockResolvedValue(['a', 'b'].map(id => ({ id, employeeId: 'employee-a', startTime: new Date('2025-01-01T12:00Z'), endTime: new Date('2025-01-01T14:00Z'), status: 'completed' })));
    const response = await request('/payroll/periods/period-a/calculate', {});
    expect(response.status).toBe(422);
    expect((await response.json()).shiftIds).toEqual(['a', 'b']);
    expect(fixture.db.payrollEntry.upsert).not.toHaveBeenCalled();
  });
  it('preserves explicit venue shift dates and permits explicitly clearing the end time', async () => {
    const shift = { id: 'shift-a', businessId: 'business-a', startTime: new Date('2025-01-01T12:00Z'), endTime: new Date('2025-01-01T14:00Z'), status: 'completed' };
    fixture.db.shift.findFirst.mockResolvedValue(shift);
    fixture.db.shift.update.mockImplementation(args => Promise.resolve({ ...shift, ...args.data }));
    expect((await request('/shifts/shift-a', { startTime: '2025-01-02T02:00Z', shiftDate: '2025-01-01', endTime: '', status: 'active' }, true, 'owner', 'PUT')).status).toBe(200);
    expect(fixture.db.shift.update.mock.lastCall[0].data).toMatchObject({ shiftDate: '2025-01-01', endTime: null, durationMin: null });
  });
  it('does not reactivate or reset an employee during an email-only update', async () => {
    const employee = { id: 'employee-a', businessId: 'business-a', email: 'old@example.test', status: 'terminated', tipEligible: false, payType: 'salary', taxExemptions: 3 };
    fixture.db.employee.findFirst.mockResolvedValueOnce(employee).mockResolvedValueOnce(null);
    fixture.db.employee.update.mockImplementation(args => Promise.resolve({ ...employee, ...args.data }));
    const response = await request('/employees/employee-a', { email: 'updated@example.test' }, true, 'owner', 'PUT');
    expect(response.status).toBe(200);
    expect((await response.json()).employee).toMatchObject({ status: 'terminated', tipEligible: false, payType: 'salary', taxExemptions: 3 });
    for (const field of ['status', 'tipEligible', 'payType', 'taxExemptions']) expect(fixture.db.employee.update.mock.calls[0][0].data).not.toHaveProperty(field);
  });
  it('preserves cash tip type and imported provenance during an employee reassignment', async () => {
    const tip = { id: 'tip-a', timestamp: new Date('2026-10-05T12:00Z'), amount: 20, tipType: 'cash', source: 'csv_import' };
    fixture.db.tipEntry.findFirst.mockResolvedValue(tip);
    fixture.db.employee.findFirst.mockResolvedValue({ id: 'employee-a', businessId: 'business-a' });
    fixture.db.tipEntry.update.mockImplementation(args => Promise.resolve({ ...tip, ...args.data }));
    const response = await request('/tips/tip-a', { employeeId: 'employee-a' }, true, 'owner', 'PUT');
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ tipType: 'cash', source: 'csv_import' });
    for (const field of ['tipType', 'source']) expect(fixture.db.tipEntry.update.mock.calls[0][0].data).not.toHaveProperty(field);
  });
  it('preserves break, pending-review and completed status during notes-only shift updates', async () => {
    for (const status of ['break', 'pending_review', 'completed']) {
      const shift = { id: 'shift-a', businessId: 'business-a', startTime: new Date('2026-10-05T12:00Z'), endTime: new Date('2026-10-05T16:00Z'), status };
      fixture.db.shift.findFirst.mockResolvedValue(shift);
      fixture.db.shift.update.mockImplementation(args => Promise.resolve({ ...shift, ...args.data }));
      const response = await request('/shifts/shift-a', { notes: 'corrected' }, true, 'owner', 'PUT');
      expect(response.status).toBe(200);
      expect((await response.json()).data.status).toBe(status);
      expect(fixture.db.shift.update.mock.lastCall[0].data).not.toHaveProperty('status');
    }
  });
  it('snapshots employee wages on manual and clock shifts while preserving an explicit imported rate', async () => {
    fixture.db.employee.findFirst.mockResolvedValue({ id: 'employee-a', businessId: 'business-a', hourlyRate: 20 });
    fixture.db.shift.findFirst.mockResolvedValue(null);
    fixture.db.shift.create.mockImplementation(args => Promise.resolve({ id: 'shift-a', ...args.data }));
    expect((await request('/shifts', { employeeId: 'employee-a', startTime: '2026-10-06T06:00Z', endTime: '2026-10-06T07:00Z', shiftDate: '2026-10-05' })).status).toBe(201);
    expect(fixture.db.shift.create.mock.lastCall[0].data).toMatchObject({ hourlyRate: 20, status: 'completed', shiftDate: '2026-10-05' });
    expect((await request('/shifts', { employeeId: 'employee-a', startTime: '2026-10-06T06:00Z', endTime: '2026-10-06T07:00Z', hourlyRate: 15 })).status).toBe(201);
    expect(fixture.db.shift.create.mock.lastCall[0].data.hourlyRate).toBe(15);
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-06T06:00Z'));
    fixture.db.businessConfiguration.findUnique.mockResolvedValue({ timeZone: 'America/Los_Angeles' });
    expect((await request('/shifts/clock-in', { employeeId: 'employee-a' })).status).toBe(201);
    expect(fixture.db.shift.create.mock.lastCall[0].data).toMatchObject({ hourlyRate: 20, shiftDate: '2026-10-05' });
  });
  it('converts termination dates on employee writes and rejects invalid dates before Prisma', async () => {
    fixture.db.employee.findFirst.mockResolvedValue(null);
    fixture.db.employee.create.mockImplementation(args => Promise.resolve({ id: 'employee-a', ...args.data }));
    const create = { firstName: 'Taylor', lastName: 'Vale', email: 'taylor@example.test', hourlyRate: 20, role: 'server', startDate: '2026-01-01', terminationDate: '2026-10-05' };
    expect((await request('/employees', create)).status).toBe(201);
    expect(fixture.db.employee.create.mock.lastCall[0].data.terminationDate).toEqual(new Date('2026-10-05'));
    fixture.db.employee.findFirst.mockResolvedValue({ id: 'employee-a' });
    fixture.db.employee.update.mockImplementation(args => Promise.resolve({ id: 'employee-a', ...args.data }));
    expect((await request('/employees/employee-a', { terminationDate: '2026-10-06' }, true, 'owner', 'PUT')).status).toBe(200);
    expect(fixture.db.employee.update.mock.lastCall[0].data.terminationDate).toEqual(new Date('2026-10-06'));
    expect((await request('/employees/employee-a', { terminationDate: 'invalid' }, true, 'owner', 'PUT')).status).toBe(400);
  });
  it('restores the login user contract on auth/me without exposing credential internals', async () => {
    const response = await request('/auth/me');
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.user).toEqual({ id: 'user-a', email: 'owner@example.test', firstName: 'Taylor', lastName: 'Vale', role: 'owner', businessId: 'business-a' });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).not.toHaveProperty('credentialVersion');
    expect(result.user).not.toHaveProperty('userId');
  });
  it('does not expose employee exports without authentication', async () => {
    const response = await request('/export', { type: 'employees', format: 'csv' }, false);
    expect(response.status).toBe(401);
    expect(fixture.db.employee.findMany).not.toHaveBeenCalled();
  });

  it('denies staff exports even with a valid session', async () => {
    const response = await request('/export', { type: 'employees', format: 'csv' }, true, 'staff');
    expect(response.status).toBe(403);
    expect(fixture.db.employee.findMany).not.toHaveBeenCalled();
  });

  it('scopes employee exports to the authenticated business', async () => {
    const response = await request('/export', { type: 'employees', format: 'csv' });
    expect(response.status).toBe(200);
    expect(fixture.db.employee.findMany.mock.calls[0][0].where.businessId).toBe('business-a');
  });

  it('loads only the authenticated business', async () => {
    const response = await request('/business');
    expect(response.status).toBe(200);
    expect(fixture.db.business.findFirst.mock.calls[0][0].where).toEqual({ id: 'business-a' });
  });

  it('does not expose tip distribution to anonymous callers', async () => {
    const response = await request('/tip-distribution/settings/business-a', undefined, false);
    expect(response.status).toBe(401);
  });

  it('rejects backup path traversal before touching files', async () => {
    const response = await request('/database/restore', { backupName: '../other.db' });
    expect(response.status).toBe(400);
    expect(fixture.restore).not.toHaveBeenCalled();
  });

  it('scopes payroll listing to the authenticated business', async () => {
    const response = await request('/payroll/periods');
    expect(response.status).toBe(200);
    expect(fixture.db.payrollPeriod.findMany.mock.calls[0][0].where.businessId).toBe('business-a');
  });
  it('rejects hostile browser origins and DNS rebinding hosts', async () => {
    expect((await request('/business', undefined, true, 'owner', undefined, { Origin: 'https://attacker.test' })).status).toBe(403);
    vi.stubEnv('SHIFTMINT_RUNTIME', 'desktop');
    expect((await request('/business', undefined, true, 'owner', undefined, { Host: 'attacker.test', Origin: 'http://attacker.test' })).status).toBe(403);
  });
  it('allows the same HTTPS origin through a configured single reverse proxy', async () => {
    vi.stubEnv('SHIFTMINT_RUNTIME', 'web');
    app.set('trust proxy', parseTrustProxy('1'));
    expect(app.get('trust proxy')).toBe(1);
    const proxyHeaders = { Host: 'shiftmint.example.test', 'X-Forwarded-Proto': 'https' };
    expect((await request('/business', undefined, true, 'owner', undefined, { ...proxyHeaders, Origin: 'https://shiftmint.example.test' })).status).toBe(200);
    expect((await request('/business', undefined, true, 'owner', undefined, { ...proxyHeaders, Origin: 'https://attacker.example.test' })).status).toBe(403);
    expect(() => parseTrustProxy('100')).toThrow();
  });
  it('rejects sessions issued before a password change', async () => {
    expect((await request('/business', undefined, true, 'owner', undefined, {}, 'old-password-hash')).status).toBe(401);
    expect(fixture.db.business.findFirst).not.toHaveBeenCalled();
  });
  it('rejects a persisted revoked session', async () => {
    fixture.db.appSetting.findUnique.mockResolvedValue({ value: 'revoked' });
    expect((await request('/business')).status).toBe(401);
  });
  it('requires hosted bootstrap authorization before reading setup input', async () => {
    vi.stubEnv('SHIFTMINT_RUNTIME', 'web');
    vi.stubEnv('BOOTSTRAP_TOKEN', 'fixture-bootstrap-token');
    expect((await request('/auth/setup', {}, false)).status).toBe(403);
    expect(fixture.db.business.create).not.toHaveBeenCalled();
  });
  it('returns 503 before auth/database reads during maintenance', async () => {
    fixture.maintenance = true;
    expect((await request('/business')).status).toBe(503);
    expect(fixture.db.user.findUnique).not.toHaveBeenCalled();
  });
  it('keeps paid payroll immutable', async () => {
    fixture.db.payrollPeriod.findFirst.mockResolvedValue({ id: 'period-a', businessId: 'business-a', status: 'paid' });
    expect((await request('/payroll/periods/period-a/calculate', {})).status).toBe(409);
    expect(fixture.db.payrollEntry.upsert).not.toHaveBeenCalled();
    expect(fixture.db.shift.findMany).not.toHaveBeenCalled();
  });
  it('scopes summary source data and uses tip occurrence time', async () => {
    fixture.db.payrollPeriod.findFirst.mockResolvedValue({ id: 'period-a', businessId: 'business-a', status: 'open', startDate: new Date('2026-10-05'), endDate: new Date('2026-10-06'), payrollEntries: [] });
    expect((await request('/payroll/periods/period-a/summary')).status).toBe(200);
    expect(fixture.db.tipEntry.findMany.mock.calls[0][0].where).toMatchObject({ businessId: 'business-a', timestamp: { gte: expect.any(Date), lt: expect.any(Date) } });
    expect(fixture.db.shift.findMany.mock.calls[0][0].where.businessId).toBe('business-a');
  });
  it('requires an existing tenant employee for clock-in', async () => {
    expect((await request('/shifts/clock-in', { jobCode: 'server' })).status).toBe(400);
    fixture.db.employee.findFirst.mockResolvedValue(null);
    expect((await request('/shifts/clock-in', { employeeId: 'foreign-employee', jobCode: 'server' })).status).toBe(404);
    expect(fixture.db.employee.findFirst.mock.calls[0][0].where).toMatchObject({ businessId: 'business-a', id: 'foreign-employee' });
    expect(fixture.db.shift.create).not.toHaveBeenCalled();
  });
  it('checks shift ownership before clock-out', async () => {
    fixture.db.shift.findFirst.mockResolvedValue(null);
    expect((await request('/shifts/clock-out', { shiftId: 'foreign-shift' })).status).toBe(404);
    expect(fixture.db.shift.findFirst.mock.calls[0][0].where).toEqual({ id: 'foreign-shift', businessId: 'business-a' });
    expect(fixture.db.shift.update).not.toHaveBeenCalled();
  });
  it('never returns bank credentials in employee responses or exports', async () => {
    fixture.db.employee.findMany.mockResolvedValue([{ id: 'employee-a', bankAccountNumber: 'fixture-account', bankRoutingNumber: 'fixture-routing' }]);
    const listing = await (await request('/employees')).json();
    const exported = await (await request('/export', { type: 'employees' })).json();
    expect(listing.employees[0]).not.toHaveProperty('bankAccountNumber');
    expect(exported.data[0]).not.toHaveProperty('bankRoutingNumber');
  });
  it('issues distinct sessions for same-second logins so logout cannot revoke a new login', async () => {
    const passwordHash = await bcrypt.hash('fixture-password', 4);
    fixture.db.user.findFirst.mockResolvedValue({ id: 'user-a', businessId: 'business-a', email: 'owner@example.test', role: 'owner', passwordHash, failedLoginAttempts: 0, lockedUntil: null });
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-05T12:00:00Z'));
    const first = await (await request('/auth/login', { email: 'owner@example.test', password: 'fixture-password' }, false)).json();
    const second = await (await request('/auth/login', { email: 'owner@example.test', password: 'fixture-password' }, false)).json();
    expect(first.token).toBeTruthy();
    expect(second.token).toBeTruthy();
    expect(second.token).not.toBe(first.token);
    expect(jwt.decode(second.token)).toMatchObject({ businessId: 'business-a', jti: expect.any(String) });
  });
  it('does not listen when hosted storage contains multiple businesses', async () => {
    vi.stubEnv('SHIFTMINT_RUNTIME', 'web'); vi.stubEnv('JWT_SECRET', 'fixture-jwt-secret-with-32-characters');
    vi.stubEnv('ENCRYPTION_KEY', '3'.repeat(64)); vi.stubEnv('BOOTSTRAP_TOKEN', 'fixture-bootstrap-with-32-characters');
    vi.stubEnv('SHIFTMINT_DATA_DIR', resolve('.tmp-tests', 'hosted-multi-business'));
    fixture.db.business.count.mockResolvedValue(2);
    await expect(startBackendServer()).rejects.toThrow('one business');
    expect(fixture.db.business.count).toHaveBeenCalledOnce();
  });
  it('retains terminated employees and weights recorded rates when saving a withholding estimate', async () => {
    const period = { id: 'period-a', businessId: 'business-a', status: 'open', startDate: new Date('2026-10-05'), endDate: new Date('2026-10-06'), payrollEntries: [] };
    fixture.db.payrollPeriod.findFirst.mockResolvedValue(period);
    fixture.db.employee.findMany.mockResolvedValue([{ id: 'employee-a', businessId: 'business-a', status: 'terminated', firstName: 'Taylor', lastName: 'Vale', hourlyRate: 20 }]);
    fixture.db.shift.findMany.mockResolvedValue([
      { id: 'shift-a', employeeId: 'employee-a', startTime: new Date('2026-10-05T16:00Z'), endTime: new Date('2026-10-05T17:00Z'), status: 'completed', hourlyRate: 10, totalSales: 50 },
      { id: 'shift-b', employeeId: 'employee-a', startTime: new Date('2026-10-06T16:00Z'), endTime: new Date('2026-10-06T23:00Z'), status: 'completed', hourlyRate: 20, totalSales: 70 },
    ]);
    fixture.db.tipEntry.findMany.mockResolvedValue([{ id: 'tip-a', employeeId: 'employee-a', amount: 30, timestamp: new Date('2026-10-05T17:00Z'), createdAt: new Date('2026-10-20'), serverName: 'Taylor Vale' }]);
    fixture.db.payrollEntry.upsert.mockImplementation(args => Promise.resolve({ id: 'entry-a', ...args.create }));
    const response = await request('/payroll/periods/period-a/calculate', {});
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.calculation.taxTreatment).toBe('estimate');
    expect(fixture.db.employee.findMany.mock.calls[0][0].where).toEqual({ businessId: 'business-a' });
    expect(fixture.db.tipEntry.findMany.mock.calls[0][0].where).toHaveProperty('timestamp');
    expect(fixture.db.payrollEntry.upsert.mock.calls[0][0].create).toMatchObject({ employeeId: 'employee-a', regularPay: 150, totalTips: 30, totalTaxes: 39.6, netPay: 140.4 });
    expect(fixture.db.payrollEntry.deleteMany.mock.calls[0][0].where).toMatchObject({ payrollPeriodId: 'period-a', employeeId: { notIn: ['employee-a'] } });
  });
  it('returns a numeric client-compatible calculated period without bank credentials after committing payroll', async () => {
    const marker = new Date('2026-10-05');
    const employee = { id: 'employee-a', businessId: 'business-a', firstName: 'Taylor', lastName: 'Vale', hourlyRate: 20, bankAccountNumber: 'fixture-account', bankRoutingNumber: 'fixture-routing' };
    const entry = { id: 'entry-a', employeeId: 'employee-a', payrollPeriodId: 'period-a', regularHours: 8, overtimeHours: 0, regularPay: 160, overtimePay: 0, grossPay: 160, totalTips: 0, totalTaxes: 35.2, netPay: 124.8, hoursWorked: 8, notes: 'ESTIMATE', createdAt: marker, updatedAt: marker, employee };
    const open = { id: 'period-a', businessId: 'business-a', status: 'open', startDate: marker, endDate: marker, createdAt: marker, updatedAt: marker, totalTips: 0, totalSales: 0, notes: null, payrollEntries: [] };
    fixture.db.payrollPeriod.findFirst.mockResolvedValueOnce(open).mockResolvedValueOnce(open).mockResolvedValueOnce({ ...open, status: 'closed', payrollEntries: [entry] });
    fixture.db.employee.findMany.mockResolvedValue([employee]);
    fixture.db.shift.findMany.mockResolvedValue([{ id: 'shift-a', employeeId: employee.id, startTime: new Date('2026-10-05T12:00Z'), endTime: new Date('2026-10-05T20:00Z'), status: 'completed', hourlyRate: 20, totalSales: 0 }]);
    fixture.db.payrollEntry.upsert.mockResolvedValue({ ...entry, employee: undefined });
    const response = await request('/payroll/periods/period-a/calculate', {});
    expect(response.status).toBe(200);
    const result = await response.json();
    const clientPeriod = toPayrollPeriodDTO(result.period);
    expect(clientPeriod).toMatchObject({ id: 'period-a', status: 'closed', payrollEntries: [{ id: 'entry-a', grossPay: 160 }] });
    expect(result.entries[0]).toMatchObject({ employeeId: 'employee-a', regularHours: 8, overtimeHours: 0, grossPay: 160, totalTaxes: 35.2, netPay: 124.8 });
    expect(result.summary).toMatchObject({ totalGrossPay: 160, totalTips: 0, totalTaxes: 35.2, totalNetPay: 124.8 });
    expect(result.calculation.taxTreatment).toBe('estimate');
    expect(result.period.payrollEntries[0].employee).not.toHaveProperty('bankAccountNumber');
    expect(result.period.payrollEntries[0].employee).not.toHaveProperty('bankRoutingNumber');
    expect(fixture.db.payrollPeriod.findFirst.mock.calls[2][0].where).toEqual({ id: 'period-a', businessId: 'business-a' });
  });
  it('voids a deleted tip and retains its audit history', async () => {
    fixture.db.tipEntry.findFirst.mockResolvedValue({ id: 'tip-a', timestamp: new Date('2026-10-05'), amount: 20 });
    expect((await request('/tips/tip-a', undefined, true, 'owner', 'DELETE')).status).toBe(200);
    expect(fixture.db.tipEntry.delete).not.toHaveBeenCalled();
    expect(fixture.db.tipEntry.update.mock.calls[0][0].data).toMatchObject({ amount: 0, complianceStatus: 'voided', version: { increment: 1 } });
    expect(fixture.db.tipAuditLog.create.mock.calls[0][0].data).toMatchObject({ tipEntryId: 'tip-a', businessId: 'business-a', action: 'delete' });
  });
  it('groups SQLite millisecond timestamps into the configured business date', async () => {
    fixture.db.businessConfiguration.findUnique.mockResolvedValue({ timeZone: 'America/Los_Angeles' });
    fixture.db.tipEntry.findMany.mockResolvedValue([{ timestamp: Date.parse('2026-10-06T06:00:00Z'), amount: 10 }, { timestamp: new Date('2026-10-06T08:00:00Z'), amount: 20 }]);
    fixture.db.tipEntry.aggregate.mockResolvedValue({ _sum: { amount: 30 }, _avg: { amount: 15 }, _count: 2 });
    const response = await request('/tips/summary'); expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.summary.dailyBreakdown).toEqual([{ date: '2026-10-06', count: 1, total: 20 }, { date: '2026-10-05', count: 1, total: 10 }]);
    expect(fixture.db.tipEntry.findMany.mock.calls[0][0].where).toMatchObject({ businessId: 'business-a', complianceStatus: { not: 'voided' } });
  });
  it('allows validated tip reassignment and retains the audit transaction', async () => {
    fixture.db.tipEntry.findFirst.mockResolvedValue({ id: 'tip-a', timestamp: new Date('2026-10-05'), amount: 20, complianceStatus: 'pending' });
    fixture.db.employee.findFirst.mockResolvedValue({ id: 'employee-a', businessId: 'business-a' });
    fixture.db.tipEntry.update.mockResolvedValue({ id: 'tip-a' });
    expect((await request('/tips/tip-a', { employeeId: 'employee-a', serverName: 'Taylor Vale', timestamp: '2026-10-06T08:00Z' }, true, 'owner', 'PUT')).status).toBe(200);
    expect(fixture.db.employee.findFirst.mock.calls[0][0].where).toEqual({ id: 'employee-a', businessId: 'business-a' });
    expect(fixture.db.tipEntry.update.mock.calls[0][0].data).toMatchObject({ employeeId: 'employee-a', serverName: 'Taylor Vale', timestamp: new Date('2026-10-06T08:00Z') });
    expect(fixture.db.tipAuditLog.create).toHaveBeenCalled();
  });
  it('rejects foreign-tenant tip reassignment and movement out of or into a closed period', async () => {
    const row = { id: 'tip-a', timestamp: new Date('2026-10-05T12:00Z'), amount: 20, complianceStatus: 'pending' };
    fixture.db.tipEntry.findFirst.mockResolvedValue(row);
    fixture.db.employee.findFirst.mockResolvedValue(null);
    expect((await request('/tips/tip-a', { employeeId: 'foreign-employee' }, true, 'owner', 'PUT')).status).toBe(404);
    const closed = { startDate: new Date('2026-10-05'), endDate: new Date('2026-10-05'), status: 'closed' };
    fixture.db.payrollPeriod.findMany.mockResolvedValue([closed]);
    expect((await request('/tips/tip-a', { timestamp: '2026-10-07T12:00Z' }, true, 'owner', 'PUT')).status).toBe(409);
    fixture.db.tipEntry.findFirst.mockResolvedValue({ ...row, timestamp: new Date('2026-10-07T12:00Z') });
    expect((await request('/tips/tip-a', { timestamp: '2026-10-05T12:00Z' }, true, 'owner', 'PUT')).status).toBe(409);
    expect(fixture.db.tipEntry.update).not.toHaveBeenCalled();
  });

  const closedPartialWeek = { startDate: new Date('2026-10-10'), endDate: new Date('2026-10-10'), status: 'closed' };
  const contextualShift = { id: 'shift-a', businessId: 'business-a', employeeId: 'employee-a', startTime: new Date('2026-10-05T16:00Z'), endTime: new Date('2026-10-05T20:00Z') };
  const partialWeek = () => {
    fixture.db.payrollPeriod.findMany.mockResolvedValue([closedPartialWeek]);
    fixture.db.businessConfiguration.findUnique.mockResolvedValue({ timeZone: 'America/Los_Angeles', payPeriodStartDay: 1 });
    fixture.db.employee.findFirst.mockResolvedValue({ id: 'employee-a', businessId: 'business-a' });
    fixture.db.shift.create.mockImplementation(args => Promise.resolve({ id: 'created-shift', ...args.data }));
    fixture.db.shift.update.mockImplementation(args => Promise.resolve({ ...contextualShift, ...args.data }));
  };
  it('rejects backdated creates and intervals overlapping the workweek context of closed partial-week payroll', async () => {
    partialWeek();
    for (const [startTime, endTime] of [['2026-10-05T16:00Z', '2026-10-05T20:00Z'], ['2026-10-05T06:30Z', '2026-10-05T08:00Z']]) {
      expect((await request('/shifts', { employeeId: 'employee-a', startTime, endTime })).status).toBe(409);
    }
    expect(fixture.db.shift.create).not.toHaveBeenCalled();
  });
  it('rejects edits, deletion, and movement out of a closed payroll workweek dependency', async () => {
    partialWeek();
    fixture.db.shift.findFirst.mockResolvedValue(contextualShift);
    expect((await request('/shifts/shift-a', { notes: 'corrected' }, true, 'owner', 'PUT')).status).toBe(409);
    expect((await request('/shifts/shift-a', { startTime: '2026-10-12T16:00Z', endTime: '2026-10-12T20:00Z' }, true, 'owner', 'PUT')).status).toBe(409);
    expect((await request('/shifts/shift-a', undefined, true, 'owner', 'DELETE')).status).toBe(409);
    expect(fixture.db.shift.update).not.toHaveBeenCalled();
    expect(fixture.db.shift.delete).not.toHaveBeenCalled();
  });
  it('rejects movement and CSV import into closed payroll workweek context', async () => {
    partialWeek();
    fixture.db.shift.findFirst.mockResolvedValue({ ...contextualShift, startTime: new Date('2026-10-12T16:00Z'), endTime: new Date('2026-10-12T20:00Z') });
    expect((await request('/shifts/shift-a', { startTime: '2026-10-05T16:00Z', endTime: '2026-10-05T20:00Z' }, true, 'owner', 'PUT')).status).toBe(409);
    fixture.db.employee.findMany.mockResolvedValue([{ id: 'employee-a', firstName: 'Taylor', lastName: 'Vale', hourlyRate: 20 }]);
    const response = await request('/shifts/import-csv', { csvData: [{ employeeId: 'employee-a', startTime: '2026-10-05T16:00Z', endTime: '2026-10-05T20:00Z' }] });
    expect((await response.json()).imported).toBe(0);
    expect(fixture.db.shift.create).not.toHaveBeenCalled();
  });
  it('blocks active and open-ended shifts overlapping closed workweek context until explicit reopen', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T18:00Z'));
    partialWeek();
    fixture.db.shift.findFirst.mockResolvedValue(null);
    expect((await request('/shifts/clock-in', { employeeId: 'employee-a' })).status).toBe(409);
    fixture.db.shift.findFirst.mockResolvedValue({ ...contextualShift, endTime: null });
    expect((await request('/shifts/clock-out', { shiftId: 'shift-a' })).status).toBe(409);
    expect((await request('/shifts', { employeeId: 'employee-a', startTime: '2026-10-04T16:00Z' })).status).toBe(409);
    expect(fixture.db.shift.create).not.toHaveBeenCalled();
    expect(fixture.db.shift.update).not.toHaveBeenCalled();
    fixture.db.payrollPeriod.findMany.mockResolvedValue([]);
    expect((await request('/shifts', { employeeId: 'employee-a', startTime: '2026-10-05T16:00Z', endTime: '2026-10-05T20:00Z' })).status).toBe(201);
  });
  it('rejects CSV tips inside a closed period but does not lock earlier tips used by no calculation', async () => {
    partialWeek();
    fixture.db.tipEntry.create.mockImplementation(args => Promise.resolve({ id: 'tip-a', ...args.data }));
    const response = await request('/tips/import-csv', { csvData: [{ amount: '20', timestamp: '2026-10-10T16:00Z' }] });
    const result = await response.json();
    expect(result.imported).toBe(0);
    expect(result.errors.join(' ')).toContain('closed');
    expect(fixture.db.tipEntry.create).not.toHaveBeenCalled();
    const earlier = await request('/tips/import-csv', { csvData: [{ amount: '20', timestamp: '2026-10-05T16:00Z' }] });
    expect((await earlier.json()).imported).toBe(1);
    expect(fixture.db.tipAuditLog.create).toHaveBeenCalled();
  });
  it('rejects invented CSV tip timestamps and ambiguous employee names', async () => {
    fixture.db.employee.findMany.mockResolvedValue([{ id: 'employee-a', firstName: 'Taylor', lastName: 'Vale' }, { id: 'employee-b', firstName: 'Taylor', lastName: 'Vale' }]);
    fixture.db.tipEntry.create.mockImplementation(args => Promise.resolve({ id: 'tip-a', ...args.data }));
    const response = await request('/tips/import-csv', { csvData: [{ amount: '20' }, { amount: '20', timestamp: '2026-10-05T16:00Z', employeeName: 'Taylor Vale' }] });
    const result = await response.json();
    expect(result.imported).toBe(0);
    expect(result.errors).toHaveLength(2);
    expect(fixture.db.tipEntry.create).not.toHaveBeenCalled();
  });
  it('preserves closed payroll dependency locks when timezone or workweek configuration changes', async () => {
    let policy = { timeZone: 'America/Los_Angeles', payPeriodStartDay: 1 };
    fixture.db.businessConfiguration.findUnique.mockImplementation(() => Promise.resolve(policy));
    fixture.db.businessConfiguration.upsert.mockImplementation(args => { policy = { ...policy, ...args.update }; return Promise.resolve(policy); });
    fixture.db.payrollPeriod.findMany.mockResolvedValue([{ startDate: new Date('2026-10-07'), endDate: new Date('2026-10-09'), status: 'closed' }]);
    fixture.db.payrollPeriod.findFirst.mockResolvedValue({ id: 'closed-period' });
    fixture.db.shift.findFirst.mockResolvedValue(contextualShift);
    fixture.db.shift.update.mockImplementation(args => Promise.resolve({ ...contextualShift, ...args.data }));
    expect((await request('/shifts/shift-a', { notes: 'corrected' }, true, 'owner', 'PUT')).status).toBe(409);
    expect((await request('/business/configuration', { payPeriodStartDay: 3 }, true, 'owner', 'PUT')).status).toBe(409);
    expect((await request('/business/configuration', { timeZone: 'America/New_York' }, true, 'owner', 'PUT')).status).toBe(409);
    expect((await request('/shifts/shift-a', { notes: 'corrected' }, true, 'owner', 'PUT')).status).toBe(409);
    expect(fixture.db.businessConfiguration.upsert).not.toHaveBeenCalled();
    expect(fixture.db.shift.update).not.toHaveBeenCalled();
  });
  it('allows unchanged effective policy and unrelated configuration while payroll is closed, then policy changes after reopen', async () => {
    fixture.db.businessConfiguration.findUnique.mockResolvedValue(null);
    fixture.db.payrollPeriod.findFirst.mockResolvedValue({ id: 'paid-period', status: 'paid' });
    fixture.db.businessConfiguration.upsert.mockImplementation(args => Promise.resolve(args.update));
    expect((await request('/business/configuration', { timeZone: 'US/Eastern', payPeriodStartDay: 1 }, true, 'owner', 'PUT')).status).toBe(200);
    expect((await request('/business/configuration', { tipPoolingEnabled: false }, true, 'owner', 'PUT')).status).toBe(200);
    fixture.db.payrollPeriod.findFirst.mockResolvedValue(null);
    expect((await request('/business/configuration', { timeZone: 'America/Los_Angeles', payPeriodStartDay: 3 }, true, 'owner', 'PUT')).status).toBe(200);
    expect(fixture.db.businessConfiguration.upsert).toHaveBeenCalledTimes(3);
  });
  it('retains timezone and workweek policy validation before configuration writes', async () => {
    for (const changes of [{ timeZone: 'invalid/timezone' }, { payPeriodStartDay: 7 }, { payPeriodStartDay: 'Monday' }]) {
      expect((await request('/business/configuration', changes, true, 'owner', 'PUT')).status).toBe(400);
    }
    expect(fixture.db.businessConfiguration.upsert).not.toHaveBeenCalled();
  });
  it('accepts an explicitly blank business website, preserves omitted values and leaves valid URLs unchanged', async () => {
    vi.stubEnv('ENCRYPTION_KEY', 'ab'.repeat(32));
    fixture.db.business.findFirst.mockResolvedValue({ id: 'business-a', website: 'https://existing.example.test' });
    fixture.db.business.update.mockImplementation(args => Promise.resolve({ id: 'business-a', ...args.data }));
    const blank = await request('/business', { website: '', phone: '', address: 'null', ein: '12-3456789' }, true, 'owner', 'PUT');
    expect(blank.status).toBe(200);
    expect(fixture.db.business.update.mock.calls[0][0].data).toMatchObject({ website: null, phone: '' });
    const response = await blank.json();
    expect(response.data).toMatchObject({ website: null, einStored: true });
    expect(response.data).not.toHaveProperty('ein');
    expect((await request('/business', { phone: '' }, true, 'owner', 'PUT')).status).toBe(200);
    expect(fixture.db.business.update.mock.calls[1][0].data).not.toHaveProperty('website');
    expect((await request('/business', { website: 'https://shiftmint.example.test' }, true, 'owner', 'PUT')).status).toBe(200);
    expect(fixture.db.business.update.mock.calls[2][0].data.website).toBe('https://shiftmint.example.test');
  });
  it('continues rejecting malformed nonempty business website values', async () => {
    expect((await request('/business', { website: 'invalid-website' }, true, 'owner', 'PUT')).status).toBe(400);
    expect(fixture.db.business.update).not.toHaveBeenCalled();
  });
});
