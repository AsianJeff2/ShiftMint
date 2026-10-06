// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../setup';
import Tips from '../../pages/Tips';
import Payroll from '../../pages/Payroll';
import Shifts from '../../pages/Shifts';
import Settings from '../../pages/Settings';
import { LiveErrorDetectionDashboard } from '../../components/error-detection/LiveErrorDetectionDashboard';
import { EmployeeList } from '../../components/employees/EmployeeList';

const mocks = vi.hoisted(() => ({
  tips: [] as any[], shifts: [] as any[], employees: [] as any[], payrollPeriods: [] as any[],
  business: null as any, errorPayroll: null as string | null, errorShifts: null as string | null,
  errorEmployees: null as string | null, errorTips: null as string | null, errorBusiness: null as string | null,
  loadingTips: false, loadingShifts: false, loadingEmployees: false, loadingPayroll: false, loadingBusiness: false,
  getTips: vi.fn(), getShifts: vi.fn(), getEmployees: vi.fn(), getPayrollPeriods: vi.fn(), getBusiness: vi.fn(),
  updateBusiness: vi.fn(), updateTip: vi.fn(), createTip: vi.fn(), deleteTip: vi.fn(),
  detectAnomalies: vi.fn().mockReturnValue([]), toast: vi.fn(), getSettings: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/contexts/DataContext', () => ({ useData: () => mocks }));
vi.mock('@/contexts/LocalAuthContext', () => ({ useLocalAuth: () => ({ user: { id: 'owner', role: 'owner' } }) }));
vi.mock('@/lib/api-client', () => ({ default: { getTipDistributionSettings: mocks.getSettings } }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('sonner', () => ({ toast: { success: mocks.toast, error: mocks.toast } }));
vi.mock('@/lib/anomaly-detection/engine', () => ({ AnomalyDetectionEngine: class { detectAnomalies = mocks.detectAnomalies; } }));
vi.mock('@/components/tips/TipCSVImport', () => ({ TipCSVImport: ({ onImportComplete }: any) => <button onClick={onImportComplete}>Acknowledge tip import</button> }));
vi.mock('@/components/shifts/ShiftCSVImport', () => ({ ShiftCSVImport: () => null }));
vi.mock('@/components/shifts/TimeClock', () => ({ TimeClock: () => null }));
vi.mock('@/components/shifts/EmployeeShiftRecords', () => ({ EmployeeShiftRecords: () => null }));
vi.mock('@/components/payroll/PayrollDetailsModal', () => ({ PayrollDetailsModal: ({ period, isOpen }: any) => isOpen && period ? <div role="dialog">Details wages: {period.payrollEntries[0].grossPay}</div> : null }));
vi.mock('@/components/payroll/PayrollEditModal', () => ({ PayrollEditModal: () => null }));
vi.mock('@/components/settings/DatabaseBackupSettings', () => ({ DatabaseBackupSettings: () => null }));
vi.mock('@/components/settings/EnhancedTippingSettings', () => ({ EnhancedTippingSettings: () => null }));
vi.mock('@/components/settings/IntegrationsSettings', () => ({ IntegrationsSettings: () => null }));
vi.mock('@/components/employees/EmployeeCSVImport', () => ({ EmployeeCSVImport: () => <button>Import employee replacements</button> }));

beforeEach(() => {
  vi.clearAllMocks();
  for (const field of ['tips', 'shifts', 'employees', 'payrollPeriods'] as const) mocks[field] = [];
  for (const field of ['errorTips', 'errorShifts', 'errorEmployees', 'errorPayroll', 'errorBusiness'] as const) mocks[field] = null;
  mocks.business = null;
  mocks.loadingShifts = mocks.loadingTips = mocks.loadingEmployees = mocks.loadingPayroll = mocks.loadingBusiness = false;
  mocks.getTips.mockReset().mockResolvedValue([]);
});
afterEach(cleanup);

describe('failed list reads never become financial zero or confirmed empty', () => {
  it.each([
    'The tip service is unavailable. Retry after checking your connection.',
    'More than 10000 tips match this range. Select a shorter date range for complete totals.',
  ])('shows an unavailable tip range and preserves the reason: %s', async reason => {
    mocks.getTips.mockRejectedValue({ userMessage: reason });
    render(<Tips />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(reason));
    expect(screen.getAllByText('Unavailable')).toHaveLength(4);
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    expect(screen.queryByText(/No tips recorded/)).not.toBeInTheDocument();
    expect(mocks.getTips).toHaveBeenCalledWith({ startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    fireEvent.click(screen.getByRole('button', { name: 'Retry tips' }));
    await waitFor(() => expect(mocks.getTips).toHaveBeenCalledTimes(2));
  });

  it('hides stale tip totals after a rejected refresh and restores them only after a successful retry', async () => {
    const record = { id: 'tip', amount: 42, tipType: 'credit', timestamp: '2026-09-05T19:00:00Z' };
    mocks.getTips.mockResolvedValueOnce([record]).mockRejectedValueOnce(new Error('Refresh failed; check connection.')).mockResolvedValueOnce([{ ...record, amount: 53 }]);
    render(<Tips />);
    await screen.findAllByText('$42.00');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh tips' }));
    await screen.findByRole('alert');
    expect(screen.queryByText('$42.00')).not.toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry tips' }));
    await screen.findAllByText('$53.00');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('narrows an over-cap tip range, reloads imports in that range, and leaves lifetime tips untouched', async () => {
    const lifetime = [{ id: 'old-tip', amount: 900, tipType: 'cash', timestamp: '2020-01-01T12:00:00Z' }];
    mocks.tips = lifetime;
    mocks.getTips.mockRejectedValueOnce(new Error('More than 10000 tips match this range. Select a shorter date range.')).mockResolvedValue([]);
    render(<Tips />);
    await screen.findByRole('alert');
    fireEvent.change(screen.getByLabelText('Tip history start date'), { target: { value: '2026-09-05' } });
    fireEvent.change(screen.getByLabelText('Tip history end date'), { target: { value: '2026-09-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply tip range' }));
    await screen.findByText('No tips recorded in this date range.');
    expect(mocks.getTips).toHaveBeenLastCalledWith({ startDate: '2026-09-05', endDate: '2026-09-05' });
    expect(mocks.tips).toBe(lifetime);
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge tip import' }));
    await waitFor(() => expect(mocks.getTips).toHaveBeenCalledTimes(3));
    expect(mocks.getTips).toHaveBeenLastCalledWith({ startDate: '2026-09-05', endDate: '2026-09-05' });
    expect(screen.queryByText('$900.00')).not.toBeInTheDocument();
  });

  it.each(['2026-09-06', ''])('rejects reversed or missing tip ranges (%s) without claiming an empty result', async startDate => {
    render(<Tips />);
    await screen.findByText('No tips recorded in this date range.');
    fireEvent.change(screen.getByLabelText('Tip history start date'), { target: { value: startDate } });
    fireEvent.change(screen.getByLabelText('Tip history end date'), { target: { value: '2026-09-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply tip range' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a start date on or before the end date.');
    expect(screen.queryByText('No tips recorded in this date range.')).not.toBeInTheDocument();
    expect(mocks.getTips).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('suppresses empty and stale payroll totals after failure (stale=%s)', async stale => {
    if (stale) mocks.payrollPeriods = [{ id: 'period', startDate: '2026-09-01', endDate: '2026-09-15', status: 'closed', payrollEntries: [{ grossPay: 500, netPay: 400, totalTaxes: 100 }] }];
    const view = render(<Payroll />);
    if (stale) expect(screen.getAllByText('$500.00').length).toBeGreaterThan(0);
    mocks.errorPayroll = 'Payroll could not load; check your connection.';
    view.rerender(<Payroll />);
    expect(screen.getByRole('alert')).toHaveTextContent(mocks.errorPayroll);
    expect(screen.getAllByText('Unavailable')).toHaveLength(3);
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    expect(screen.queryByText('$500.00')).not.toBeInTheDocument();
    expect(screen.queryByText('No payroll periods')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export period CSV' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry payroll' }));
    expect(mocks.getPayrollPeriods).toHaveBeenCalledTimes(1);
    mocks.errorPayroll = null;
    view.rerender(<Payroll />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([false, true])('suppresses confirmed-empty and stale shifts after failure (stale=%s)', stale => {
    if (stale) mocks.shifts = [{ id: 'shift', status: 'completed', jobCode: 'Recorded shift job', startTime: '2026-09-01T12:00:00Z', endTime: '2026-09-01T20:00:00Z' }];
    const view = render(<Shifts />);
    if (stale) expect(screen.getByText('Recorded shift job')).toBeInTheDocument();
    mocks.errorShifts = 'Shifts could not load; retry after checking your connection.';
    view.rerender(<Shifts />);
    expect(screen.getByRole('alert')).toHaveTextContent(mocks.errorShifts);
    expect(screen.queryByText(/No shifts recorded/)).not.toBeInTheDocument();
    expect(screen.queryByText('Recorded shift job')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry shifts' }));
    expect(mocks.getShifts).toHaveBeenCalledTimes(1);
    mocks.errorShifts = null;
    view.rerender(<Shifts />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hides already-open payroll details when refresh fails and binds retry details to the refreshed period', () => {
    mocks.payrollPeriods = [{ id: 'period', startDate: '2026-09-01', endDate: '2026-09-15', status: 'closed', payrollEntries: [{ grossPay: 500, netPay: 400, totalTaxes: 100 }] }];
    const view = render(<Payroll />);
    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Details wages: 500');
    mocks.errorPayroll = 'Payroll refresh failed.';
    view.rerender(<Payroll />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    mocks.errorPayroll = null;
    mocks.payrollPeriods = [{ ...mocks.payrollPeriods[0], payrollEntries: [{ grossPay: 600, netPay: 450, totalTaxes: 150 }] }];
    view.rerender(<Payroll />);
    expect(screen.getByRole('dialog')).toHaveTextContent('Details wages: 600');
  });

  it('disables business overwrite after a failed read, with a retry and submit guard', () => {
    mocks.errorBusiness = 'Saved business settings could not load.';
    const view = render(<Settings />);
    expect(screen.getByRole('alert')).toHaveTextContent(mocks.errorBusiness);
    expect(screen.getByLabelText('Business Name *')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Update Business Information' })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText('Business Name *').closest('form')!);
    expect(mocks.updateBusiness).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry business settings' }));
    expect(mocks.getBusiness).toHaveBeenCalledTimes(1);
    mocks.errorBusiness = null;
    mocks.business = { id: 'business', name: 'Saved business', type: 'restaurant', phone: '555-0101' };
    view.rerender(<Settings />);
    expect(screen.getByLabelText('Phone Number')).toHaveValue('555-0101');
    expect(screen.getByRole('button', { name: 'Update Business Information' })).toBeEnabled();
  });

  it.each([false, true])('suppresses employee counts, empty states and write invitations after failure (stale=%s)', stale => {
    if (stale) mocks.employees = [{ id: 'employee', firstName: 'Ada', lastName: 'Fixture', email: 'ada@example.test', role: 'server', hourlyRate: 20, status: 'active', tipEligible: true }];
    const view = render(<EmployeeList />);
    if (stale) expect(screen.getByText('Ada Fixture')).toBeInTheDocument();
    mocks.errorEmployees = 'Roster unavailable. Check your connection.';
    view.rerender(<EmployeeList />);
    expect(screen.getByRole('alert')).toHaveTextContent(mocks.errorEmployees);
    expect(screen.getAllByText('Unavailable')).toHaveLength(3);
    expect(screen.queryByText('No employees found')).not.toBeInTheDocument();
    expect(screen.queryByText('Ada Fixture')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Employee' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import employee replacements' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry employees' }));
    expect(mocks.getEmployees).toHaveBeenCalledTimes(1);
    mocks.errorEmployees = null;
    view.rerender(<EmployeeList />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Employee' })).toBeEnabled();
  });

  it.each(['errorTips', 'errorShifts', 'errorEmployees'] as const)('does not analyze incomplete source data after %s', async field => {
    const view = render(<LiveErrorDetectionDashboard />);
    await waitFor(() => expect(mocks.detectAnomalies).toHaveBeenCalledTimes(1));
    mocks[field] = 'Source records unavailable.';
    view.rerender(<LiveErrorDetectionDashboard />);
    expect(screen.getByRole('alert')).toHaveTextContent('Source records unavailable.');
    expect(screen.queryByText(/Your data looks good/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run Analysis' })).not.toBeInTheDocument();
    expect(mocks.detectAnomalies).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Retry analysis data' }));
    expect(mocks.getTips).toHaveBeenCalledTimes(1);
    expect(mocks.getShifts).toHaveBeenCalledTimes(1);
    expect(mocks.getEmployees).toHaveBeenCalledTimes(1);
    mocks[field] = null;
    view.rerender(<LiveErrorDetectionDashboard />);
    await waitFor(() => expect(mocks.detectAnomalies).toHaveBeenCalledTimes(2));
  });
});
