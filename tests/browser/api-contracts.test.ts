// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../../lib/api-client';
import { TipResponseSchema } from '../../lib/types/api-dtos';
import { toTipEntryDTO } from '../../lib/transformers/tipTransformer';

afterEach(() => { vi.unstubAllGlobals(); delete (window as unknown as Record<string, unknown>).electronAPI; });
describe('browser authentication HTTP contracts', () => {
  it('preserves linked shift IDs through response parsing, list/create/update DTOs and a notes-only request', async () => {
    const marker = '2026-09-05T19:00:00.000Z';
    const wire = TipResponseSchema.parse({ id: 'tip-linked', businessId: 'business-a', employeeId: 'employee-a', shiftId: 'shift-linked', amount: 10, tipType: 'cash', source: 'manual', tableNumber: null, serverName: 'Taylor Vale', posTransactionId: null, isPooled: false, poolDistributionId: null, taxableAmount: 10, notes: 'original', timestamp: marker, processed: false, processedAt: null, complianceStatus: 'pending', wageCreditUsed: 0, irsReportable: false, version: 1, lastModifiedBy: null, originalAmount: null, changeReason: null, transactionId: null, createdAt: marker, updatedAt: marker });
    expect(wire.shiftId).toBe('shift-linked'); expect(toTipEntryDTO(wire).shiftId).toBe('shift-linked');
    const fetch = vi.fn().mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ success: true, tips: [wire], total: 1, pagination: { offset: 0, hasMore: false } })))).mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ success: true, data: wire }))));
    vi.stubGlobal('fetch', fetch);
    expect((await apiClient.getTips())[0].shiftId).toBe('shift-linked');
    expect((await apiClient.createTip({ amount: 10, employeeId: 'employee-a', shiftId: 'shift-linked', tipType: 'cash', source: 'manual', isPooled: false, timestamp: marker })).shiftId).toBe('shift-linked');
    expect((await apiClient.updateTip('tip-linked', { notes: 'corrected' })).shiftId).toBe('shift-linked');
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ notes: 'corrected' });
  });
  it('normalizes rejected CSV row strings into the declared browser error contract', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ success: true, imported: 1, errors: ['Row 2: Invalid rate'] }))));
    vi.stubGlobal('fetch', fetch);
    for (const run of [() => apiClient.importShiftsFromCSV([]), () => apiClient.importEmployeesFromCSV([]), () => apiClient.importTipsFromCSV([])]) expect(await run()).toMatchObject({ imported: 1, failed: 1, errors: [{ row: 2, error: 'Invalid rate' }] });
  });
  it('uses the actual employee-filter endpoint and typed bulk-delete confirmation body', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ success: true, shifts: [] }))));
    vi.stubGlobal('fetch', fetch);
    await apiClient.getEmployeeShifts('employee-a', { startDate: '2025-01-01' });
    expect(fetch.mock.calls[0][0]).toContain('/shifts?employeeId=employee-a&startDate=2025-01-01');
    await apiClient.deleteAllShifts('DELETE ALL SHIFTS');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ confirmation: 'DELETE ALL SHIFTS' });
  });
  it('sends the per-launch desktop capability on every API request without persisting it', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ status: 'ok' }))));
    vi.stubGlobal('fetch', fetch);
    const capability = vi.fn().mockResolvedValueOnce('launch-one').mockResolvedValueOnce('launch-two');
    Object.assign(window, { electronAPI: { getApiToken: capability } });
    await apiClient.healthCheck(); await apiClient.healthCheck();
    expect(fetch.mock.calls.map(call => call[1].headers['X-Desktop-Token'])).toEqual(['launch-one', 'launch-two']);
    expect(Object.values(localStorage)).not.toContain('launch-one');
  });
  it('maps clock data envelopes and grouped employees through complete wire DTOs', async () => {
    const marker = '2025-01-01T00:00:00.000Z';
    const shift = { id: 'shift-a', businessId: 'business-a', employeeId: 'employee-a', startTime: marker, endTime: '2025-01-01T02:00:00.000Z', createdAt: marker, updatedAt: marker, status: 'completed', totalWage: 40 };
    const employee = { id: 'employee-a', startDate: marker, createdAt: marker, updatedAt: marker };
    const fetch = vi.fn().mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ success: true, data: shift })))).mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ success: true, data: shift })))).mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ success: true, complete: true, data: [{ employee, shifts: [shift], totalHours: 2, totalWages: 40 }] }))));
    vi.stubGlobal('fetch', fetch);
    expect((await apiClient.clockIn('employee-a')).shift.id).toBe('shift-a');
    expect((await apiClient.clockOut('shift-a')).shift.id).toBe('shift-a');
    expect((await apiClient.getShiftsByEmployee())[0]).toMatchObject({ totalWages: 40, employee: { startDate: '2025-01-01' }, shifts: [{ id: 'shift-a', totalWage: 40 }] });
  });
  it('fetches all filtered tip pages and rejects stalled pages rather than reporting partial totals', async () => {
    const marker = '2025-01-01T00:00:00.000Z';
    const tip = (id: string) => ({ id, amount: 10, timestamp: marker, createdAt: marker, updatedAt: marker });
    const fetch = vi.fn().mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ tips: [tip('a')], pagination: { offset: 0, hasMore: true } })))).mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ tips: [tip('b')], pagination: { offset: 1, hasMore: false } })))).mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ tips: [], pagination: { offset: 0, hasMore: true } }))));
    vi.stubGlobal('fetch', fetch);
    expect((await apiClient.getTips({ startDate: '2025-01-01', endDate: '2025-01-01' })).map(tip => tip.id)).toEqual(['a', 'b']);
    expect(fetch.mock.calls[1][0]).toContain('offset=1');
    await expect(apiClient.getTips()).rejects.toThrow('pagination did not progress');
  });
  it('rejects a bounded range exceeding the tip cap without returning its partial financial records', async () => {
    const fetch = vi.fn().mockImplementation((url: string) => {
      const offset = Number(new URL(url, 'http://localhost').searchParams.get('offset') || 0);
      const tips = Array.from({ length: 500 }, (_, index) => ({ id: `tip-${offset + index}`, amount: 10 }));
      return Promise.resolve(new Response(JSON.stringify({ tips, pagination: { offset, hasMore: true } })));
    });
    vi.stubGlobal('fetch', fetch);
    await expect(apiClient.getTips({ startDate: '2026-09-01', endDate: '2026-09-30' })).rejects.toThrow('More than 10000 tips match this range. Select a shorter date range for complete totals.');
    expect(fetch).toHaveBeenCalledTimes(21);
    for (const [url] of fetch.mock.calls) {
      const query = new URL(url, 'http://localhost').searchParams;
      expect(query.get('startDate')).toBe('2026-09-01');
      expect(query.get('endDate')).toBe('2026-09-30');
      expect(query.get('limit')).toBe('500');
    }
  });
  it('maps actual tip summary money/count fields and preserves export review metadata', async () => {
    const fetch = vi.fn().mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ summary: { totalTips: 2, totalAmount: 30, avgAmount: 15, cashTips: { amount: 10 }, creditTips: { amount: 20 } } })))).mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ success: true, data: [], taxTreatment: 'estimate', warnings: ['Review'] }))));
    vi.stubGlobal('fetch', fetch);
    expect(await apiClient.getTipSummary()).toEqual({ totalTips: 30, tipCount: 2, averageTip: 15, tipsByType: { cash: 10, credit: 20 } });
    const options = { includeEmployeeDetails: false, includeTipBreakdown: false, includePayrollCalculations: true };
    expect(await apiClient.exportData({ type: 'comprehensive', format: 'json', options })).toMatchObject({ taxTreatment: 'estimate', warnings: ['Review'] });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ options });
  });
  it('sends the confirmation required by the password change API', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, requiresLogin: true })));
    vi.stubGlobal('fetch', fetch);
    await apiClient.changePassword('old-password', 'new-password');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ currentPassword: 'old-password', newPassword: 'new-password', confirmPassword: 'new-password' });
  });
  it('uses the trusted desktop capability as a header without putting it in the setup body', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
    vi.stubGlobal('fetch', fetch);
    Object.assign(window, { electronAPI: { getBootstrapToken: vi.fn().mockResolvedValue('ephemeral-capability') } });
    await apiClient.setup({ email: 'owner@example.test', password: 'test-password', firstName: 'Test', lastName: 'Owner', businessName: 'Workspace' });
    expect(fetch.mock.calls[0][1].headers['X-Bootstrap-Token']).toBe('ephemeral-capability');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty('bootstrapToken');
    expect(localStorage.getItem('bootstrapToken')).toBeNull();
  });
});
