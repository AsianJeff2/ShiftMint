// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider, useData } from '@/contexts/DataContext';
import { useEmployees } from '@/hooks/useEmployees';
import type { EmployeeDTO } from '@/lib/transformers';
import type { CreateEmployeeRequest, UpdateEmployeeRequest } from '@/lib/types/api-dtos';

const fixture = vi.hoisted(() => ({
  employees: [] as EmployeeDTO[],
  periods: [] as { id: string; status: 'open' | 'closed' }[],
  user: { id: 'owner-a', businessId: 'business-a', role: 'owner' },
  getEmployees: vi.fn(),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  deleteEmployee: vi.fn(),
  importEmployeesFromCSV: vi.fn(),
  getPayrollPeriods: vi.fn(),
  calculatePayroll: vi.fn(),
}));

vi.mock('@/contexts/LocalAuthContext', () => ({ useLocalAuth: () => ({ user: fixture.user }) }));
vi.mock('@/lib/api-client', () => ({ default: {
  getEmployees: fixture.getEmployees,
  createEmployee: fixture.createEmployee,
  updateEmployee: fixture.updateEmployee,
  deleteEmployee: fixture.deleteEmployee,
  importEmployeesFromCSV: fixture.importEmployeesFromCSV,
  getShifts: vi.fn().mockResolvedValue([]),
  getTips: vi.fn().mockResolvedValue([]),
  getPayrollPeriods: fixture.getPayrollPeriods,
  calculatePayroll: fixture.calculatePayroll,
  getBusiness: vi.fn().mockResolvedValue({ data: { id: 'business-a' } }),
  getAnalyticsSettings: vi.fn().mockResolvedValue({ analyticsEnabled: false }),
} }));

const request: CreateEmployeeRequest = {
  firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', role: 'server',
  hourlyRate: 20, startDate: '2026-10-01', status: 'active', tipEligible: true,
  payType: 'hourly', taxExemptions: 0,
};

function employee(id: string, changes: Partial<EmployeeDTO> = {}): EmployeeDTO {
  return { ...request, id, businessId: 'business-a', employeeNumber: id,
    createdAt: '2026-10-05T00:00:00.000Z', updatedAt: '2026-10-05T00:00:00.000Z', ...changes };
}

function consumers() {
  return renderHook(() => ({ list: useEmployees(), shared: useData() }), {
    wrapper: ({ children }: { children: React.ReactNode }) => <DataProvider>{children}</DataProvider>,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.employees = [];
  fixture.periods = [];
  fixture.getPayrollPeriods.mockImplementation(async () => fixture.periods.map(period => ({ ...period })));
  fixture.getEmployees.mockImplementation(async () => ({ employees: fixture.employees.map(row => ({ ...row })) }));
  fixture.createEmployee.mockImplementation(async (data: CreateEmployeeRequest) => {
    const created = employee(`employee-${fixture.employees.length + 1}`, data);
    fixture.employees.push(created);
    return { success: true, employee: { ...created } };
  });
  fixture.updateEmployee.mockImplementation(async (id: string, data: UpdateEmployeeRequest) => {
    fixture.employees = fixture.employees.map(row => row.id === id ? { ...row, ...data } : row);
    return { success: true, employee: { ...fixture.employees.find(row => row.id === id)! } };
  });
  fixture.deleteEmployee.mockImplementation(async (id: string) => {
    fixture.employees = fixture.employees.map(row => row.id === id ? { ...row, status: 'terminated' } : row);
    return { success: true };
  });
  fixture.importEmployeesFromCSV.mockImplementation(async () => {
    fixture.employees.push(employee('csv-employee', { firstName: 'Grace', lastName: 'Hopper' }));
    return { success: true, imported: 1, failed: 0, errors: [] };
  });
});

describe('payroll state after an unsuccessful calculation response', () => {
  it('refreshes persisted period changes even when response parsing rejects the request', async () => {
    fixture.periods = [{ id: 'period-a', status: 'open' }];
    const parsingError = new Error('Invalid payroll calculation response');
    fixture.calculatePayroll.mockImplementationOnce(async () => {
      fixture.periods = [{ id: 'period-a', status: 'closed' }];
      throw parsingError;
    });
    const { result } = consumers();
    await waitFor(() => expect(result.current.shared.payrollPeriods[0]?.status).toBe('open'));
    await act(async () => {
      await expect(result.current.shared.calculatePayroll('period-a')).rejects.toBe(parsingError);
    });
    expect(result.current.shared.payrollPeriods[0].status).toBe('closed');
    expect(fixture.calculatePayroll).toHaveBeenCalledWith('period-a');
  });

  it('keeps the calculation error if the subsequent refresh also fails', async () => {
    fixture.periods = [{ id: 'period-a', status: 'open' }];
    const parsingError = new Error('Original calculation error');
    fixture.calculatePayroll.mockRejectedValueOnce(parsingError);
    const { result } = consumers();
    await waitFor(() => expect(result.current.shared.payrollPeriods[0]?.status).toBe('open'));
    fixture.getPayrollPeriods.mockRejectedValueOnce(new Error('Refresh unavailable'));
    await act(async () => {
      await expect(result.current.shared.calculatePayroll('period-a')).rejects.toBe(parsingError);
    });
    expect(result.current.shared.errorPayroll).toBe('Refresh unavailable');
    expect(result.current.shared.loadingPayroll).toBe(false);
  });
});
afterEach(cleanup);

describe('employee changes shared across mounted screens', () => {
  it('makes a list-created employee visible to shift/payroll consumers without a reload', async () => {
    const { result } = consumers();
    await waitFor(() => expect(fixture.getEmployees).toHaveBeenCalled());
    await act(async () => { await result.current.list.createEmployee(request); });
    expect(result.current.list.employees.map(row => row.id)).toEqual(['employee-1']);
    expect(result.current.shared.employees.map(row => row.id)).toEqual(['employee-1']);
  });

  it('shares edited employee details and termination status with other screens', async () => {
    fixture.employees = [employee('employee-a')];
    const { result } = consumers();
    await waitFor(() => expect(result.current.shared.employees).toHaveLength(1));
    await act(async () => { await result.current.list.updateEmployee('employee-a', { hourlyRate: 24, firstName: 'Augusta' }); });
    expect(result.current.shared.employees[0]).toMatchObject({ hourlyRate: 24, firstName: 'Augusta' });
    await act(async () => { await result.current.list.deleteEmployee('employee-a'); });
    expect(result.current.shared.employees[0].status).toBe('terminated');
    expect(result.current.list.employees[0].status).toBe('terminated');
  });

  it('makes a shared CSV import visible to an already-mounted employee hook', async () => {
    const { result } = consumers();
    await waitFor(() => expect(fixture.getEmployees).toHaveBeenCalled());
    await act(async () => { await result.current.shared.importEmployeesFromCSV([{ firstName: 'Grace', lastName: 'Hopper' }]); });
    expect(result.current.shared.employees[0]).toMatchObject({ id: 'csv-employee', firstName: 'Grace' });
    expect(result.current.list.employees[0]).toMatchObject({ id: 'csv-employee', firstName: 'Grace' });
  });

  it('refreshes the global employee list after an external CSV import completes', async () => {
    const { result } = consumers();
    await waitFor(() => expect(fixture.getEmployees).toHaveBeenCalled());
    fixture.employees.push(employee('external-employee'));
    await act(async () => { await result.current.list.refreshEmployees(); });
    expect(result.current.shared.employees.map(row => row.id)).toEqual(['external-employee']);
    expect(result.current.list.employees.map(row => row.id)).toEqual(['external-employee']);
  });

  it('shares employee refresh loading and failures rather than displaying stale success', async () => {
    const { result } = consumers();
    await waitFor(() => expect(fixture.getEmployees).toHaveBeenCalled());
    let rejectRead: (error: Error) => void = () => { throw new Error('Missing read promise'); };
    fixture.getEmployees.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRead = reject; }));
    let refresh: Promise<void>;
    act(() => { refresh = result.current.shared.getEmployees(); });
    expect(result.current.shared.loadingEmployees).toBe(true);
    expect(result.current.list.loading).toBe(true);
    await act(async () => { rejectRead(new Error('Employee access denied')); await refresh!; });
    expect(result.current.shared.errorEmployees).toBe('Employee access denied');
    expect(result.current.list.error).toBe('Employee access denied');
    expect(result.current.list.loading).toBe(false);
  });
});
