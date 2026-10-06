// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider, useData } from '@/contexts/DataContext';

const fixture = vi.hoisted(() => ({
  user: null as null | { id: string; businessId: string; role: string },
  employees: [{ id: 'employee-a' }], tips: [{ id: 'tip-a' }, { id: 'tip-b' }], shifts: [{ id: 'shift-a' }, { id: 'shift-b' }],
  api: { getEmployees: vi.fn(), getTips: vi.fn(), getShifts: vi.fn(), getPayrollPeriods: vi.fn(), getBusiness: vi.fn(), getAnalyticsSettings: vi.fn(), createTip: vi.fn(), exportData: vi.fn() },
  download: vi.fn(),
}));
vi.mock('@/contexts/LocalAuthContext', () => ({ useLocalAuth: () => ({ user: fixture.user }) }));
vi.mock('@/lib/api-client', () => ({ default: fixture.api }));
vi.mock('@/lib/export/download', () => ({ downloadExport: fixture.download }));
const wrapper = ({ children }: { children: React.ReactNode }) => <DataProvider>{children}</DataProvider>;
beforeEach(() => {
  vi.clearAllMocks();
  fixture.user = { id: 'owner-a', businessId: 'business-a', role: 'owner' };
  fixture.api.getEmployees.mockImplementation(async () => ({ employees: fixture.employees }));
  fixture.api.getTips.mockImplementation(async (range) => range ? [fixture.tips[1]] : fixture.tips);
  fixture.api.getShifts.mockImplementation(async (range) => range ? [fixture.shifts[1]] : fixture.shifts);
  fixture.api.getPayrollPeriods.mockResolvedValue([{ id: 'payroll-a' }]);
  fixture.api.getBusiness.mockResolvedValue({ data: { id: 'business-a' } });
  fixture.api.getAnalyticsSettings.mockResolvedValue({ analyticsEnabled: true });
});
afterEach(cleanup);

describe('scoped shared data and export state', () => {
  it('returns filtered records without replacing the complete shared lists', async () => {
    const { result } = renderHook(useData, { wrapper });
    await waitFor(() => expect(result.current.shifts).toHaveLength(2));
    const range = { startDate: '2026-10-01T00:00:00Z', endDate: '2026-10-31T23:59:59Z' };
    await act(async () => {
      expect(await result.current.getTips(range)).toEqual([fixture.tips[1]]);
      expect(await result.current.getShifts(range)).toEqual([fixture.shifts[1]]);
    });
    expect(fixture.api.getTips).toHaveBeenLastCalledWith(range);
    expect(fixture.api.getShifts).toHaveBeenLastCalledWith(range);
    expect(result.current.tips).toEqual(fixture.tips);
    expect(result.current.shifts).toEqual(fixture.shifts);
  });

  it('clears a failed full refresh and preserves its actionable reason', async () => {
    const { result } = renderHook(useData, { wrapper });
    await waitFor(() => expect(result.current.employees).toHaveLength(1));
    fixture.api.getEmployees.mockRejectedValueOnce({ userMessage: 'Your employee access was revoked' });
    await act(async () => { await result.current.getEmployees(); });
    expect(result.current.employees).toEqual([]);
    expect(result.current.errorEmployees).toBe('Your employee access was revoked');
    expect(result.current.loadingEmployees).toBe(false);
  });

  it.each(['tips', 'shifts'] as const)('keeps a failed complete %s read unavailable after a successful filtered query', async collection => {
    const { result } = renderHook(useData, { wrapper });
    await waitFor(() => expect(result.current[collection]).toHaveLength(2));
    const api = collection === 'tips' ? fixture.api.getTips : fixture.api.getShifts;
    const reason = `Complete ${collection} history exceeds the record limit.`;
    api.mockRejectedValueOnce(new Error(reason));
    await act(async () => { await (collection === 'tips' ? result.current.getTips() : result.current.getShifts()); });
    const errorField = collection === 'tips' ? 'errorTips' : 'errorShifts';
    expect(result.current[errorField]).toBe(reason);
    expect(result.current[collection]).toEqual([]);
    await act(async () => {
      const range = { startDate: '2026-09-05', endDate: '2026-09-05' };
      const records = await (collection === 'tips' ? result.current.getTips(range) : result.current.getShifts(range));
      expect(records).toHaveLength(1);
    });
    expect(result.current[errorField]).toBe(reason);
    expect(result.current[collection]).toEqual([]);
    await act(async () => { await (collection === 'tips' ? result.current.getTips() : result.current.getShifts()); });
    expect(result.current[errorField]).toBeNull();
    expect(result.current[collection]).toHaveLength(2);
  });

  it.each(['tips', 'shifts'] as const)('does not invalidate complete %s data when an independent filtered query fails', async collection => {
    const { result } = renderHook(useData, { wrapper });
    await waitFor(() => expect(result.current[collection]).toHaveLength(2));
    (collection === 'tips' ? fixture.api.getTips : fixture.api.getShifts).mockRejectedValueOnce(new Error('Filtered request failed'));
    await act(async () => {
      const range = { startDate: '2026-09-05', endDate: '2026-09-05' };
      await expect(collection === 'tips' ? result.current.getTips(range) : result.current.getShifts(range)).rejects.toThrow('Filtered request failed');
    });
    expect(result.current[collection]).toHaveLength(2);
    expect(result.current[collection === 'tips' ? 'errorTips' : 'errorShifts']).toBeNull();
  });

  it('clears inaccessible collections and skips denied requests after an owner becomes staff', async () => {
    const { result, rerender } = renderHook(useData, { wrapper });
    await waitFor(() => expect(result.current.business?.id).toBe('business-a'));
    const previous = result.current;
    vi.clearAllMocks();
    fixture.user = { id: 'staff-a', businessId: 'business-a', role: 'staff' };
    rerender();
    await waitFor(() => expect(result.current.tips).toHaveLength(2));
    expect(result.current.employees).toEqual([]);
    expect(result.current.shifts).toEqual([]);
    expect(result.current.payrollPeriods).toEqual([]);
    expect(result.current.business).toBeNull();
    expect(result.current.analyticsEnabled).toBe(false);
    expect(fixture.api.getEmployees).not.toHaveBeenCalled();
    expect(fixture.api.getShifts).not.toHaveBeenCalled();
    expect(fixture.api.getPayrollPeriods).not.toHaveBeenCalled();
    expect(fixture.api.getBusiness).not.toHaveBeenCalled();
    expect(fixture.api.getAnalyticsSettings).not.toHaveBeenCalled();
    await expect(previous.createTip({ amount: 5 } as any)).rejects.toThrow('session changed');
    expect(fixture.api.createTip).not.toHaveBeenCalled();
    await expect(result.current.exportData({ type: 'tips', format: 'json' })).rejects.toThrow('permission');
    expect(fixture.api.exportData).not.toHaveBeenCalled();
  });

  it('ignores a delayed previous-workspace response after a new user signs in', async () => {
    let finishOld!: (value: { employees: { id: string }[] }) => void;
    fixture.api.getEmployees.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
    const { result, rerender } = renderHook(useData, { wrapper });
    await waitFor(() => expect(fixture.api.getEmployees).toHaveBeenCalledOnce());
    fixture.api.getEmployees.mockResolvedValue({ employees: [{ id: 'employee-new-business' }] });
    fixture.user = { id: 'owner-b', businessId: 'business-b', role: 'owner' };
    rerender();
    await waitFor(() => expect(result.current.employees[0]?.id).toBe('employee-new-business'));
    await act(async () => { finishOld({ employees: [{ id: 'private-old-business' }] }); });
    expect(result.current.employees[0]?.id).toBe('employee-new-business');
  });

  it('passes export filters/options unchanged and downloads the server estimate disclosure', async () => {
    const { result } = renderHook(useData, { wrapper });
    const request = { type: 'comprehensive' as const, format: 'json' as const, startDate: '2026-10-01', endDate: '2026-10-31', options: { includeEmployeeDetails: false, includeTipBreakdown: true, includePayrollCalculations: false } };
    fixture.api.exportData.mockResolvedValue({ success: true, data: [{ tips: [{ id: 'tip-a' }] }], taxTreatment: 'estimate', warnings: ['Not a tax filing or payment instruction'] });
    await act(async () => { await result.current.exportData(request); });
    expect(fixture.api.exportData).toHaveBeenCalledWith(request);
    expect(fixture.download).toHaveBeenCalledWith([{ tips: [{ id: 'tip-a' }] }], 'comprehensive', 'json', { taxTreatment: 'estimate', warnings: ['Not a tax filing or payment instruction'] });
  });

  it('does not download an export after logout even when the server request succeeds', async () => {
    let finishExport!: (value: { success: boolean; data: unknown[] }) => void;
    fixture.api.exportData.mockImplementationOnce(() => new Promise(resolve => { finishExport = resolve; }));
    const { result, rerender } = renderHook(useData, { wrapper });
    let request!: Promise<void>;
    act(() => { request = result.current.exportData({ type: 'tips', format: 'json' }); });
    const expectedFailure = expect(request).rejects.toThrow('session changed');
    fixture.user = null;
    rerender();
    await act(async () => { finishExport({ success: true, data: [] }); await expectedFailure; });
    expect(fixture.download).not.toHaveBeenCalled();
    expect(result.current.tips).toEqual([]);
  });
});
