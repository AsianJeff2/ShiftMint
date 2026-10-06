// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../setup';
import Shifts from '../../pages/Shifts';
import Tips from '../../pages/Tips';
import { TimeClock } from '../../components/shifts/TimeClock';
import { EmployeeShiftRecords } from '../../components/shifts/EmployeeShiftRecords';
import { shiftFormRequest } from '../../lib/shifts/form-request';
import { LiveErrorDetectionDashboard, shiftDurationMinutes } from '../../components/error-detection/LiveErrorDetectionDashboard';

const mocks = vi.hoisted(() => ({
  updateShift: vi.fn(), createShift: vi.fn(), getShifts: vi.fn(), getTips: vi.fn(), updateTip: vi.fn(), createTip: vi.fn(), clockIn: vi.fn(), clockOut: vi.fn(), getShiftsByEmployee: vi.fn(), toast: vi.fn(),
  employees: [{ id: 'employee', firstName: 'Ada', lastName: 'Test', status: 'active', role: 'server', hourlyRate: 20 }],
  shifts: [] as any[], tips: [] as any[], loadingShifts: false, loadingEmployees: false,
  detectAnomalies: vi.fn().mockReturnValue([]),
}));
vi.mock('@/contexts/DataContext', () => ({ useData: () => ({ ...mocks, loadingTips: false }) }));
vi.mock('@/lib/api-client', () => ({ default: { getShiftsByEmployee: mocks.getShiftsByEmployee } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('sonner', () => ({ toast: { success: mocks.toast, error: mocks.toast } }));
vi.mock('@/lib/anomaly-detection/engine', () => ({ AnomalyDetectionEngine: class { detectAnomalies = mocks.detectAnomalies; } }));
vi.mock('@/components/shifts/ShiftCSVImport', () => ({ ShiftCSVImport: () => null }));
vi.mock('@/components/tips/TipCSVImport', () => ({ TipCSVImport: () => null }));
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => <div><input aria-label="Select test value" value={value ?? ''} onChange={event => onValueChange?.(event.target.value)} />{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <div hidden>{children}</div>,
  SelectItem: ({ children }: any) => <span>{children}</span>,
}));

const historicalShift = { id: 'shift', employeeId: 'employee', startTime: '2026-09-01T20:00:00-07:00', endTime: '2026-09-02T04:00:00-07:00', shiftDate: '2026-09-01', jobCode: 'server', locationId: 'main', status: 'completed', hourlyRate: 35, regularWage: 280, overtimeWage: 0, totalWage: 280, totalSales: 100, cashSales: 40, creditCardSales: 60, totalTips: 10, cashTips: 3, creditCardTips: 7, notes: 'original' };
beforeEach(() => { vi.clearAllMocks(); mocks.shifts = []; mocks.tips = []; mocks.loadingShifts = false; mocks.loadingEmployees = false; mocks.getShiftsByEmployee.mockResolvedValue([]); mocks.getTips.mockImplementation(async () => mocks.tips); });
afterEach(cleanup);

describe('record-preserving shift and tip workflows', () => {
  it('keeps the selected Time Clock tab and employee mounted through a shifts refresh', async () => {
    const view = render(<Shifts />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Time Clock' }), { button: 0, ctrlKey: false });
    const employee = await screen.findByLabelText('Employee');
    fireEvent.change(employee, { target: { value: 'employee' } });
    mocks.loadingShifts = true;
    view.rerender(<Shifts />);
    expect(screen.getByRole('tab', { name: 'Time Clock' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Employee')).toBe(employee);
    expect(screen.getByLabelText('Employee')).toHaveValue('employee');
    mocks.loadingShifts = false;
    view.rerender(<Shifts />);
    expect(screen.getByLabelText('Employee')).toHaveValue('employee');
  });
  it('shows actionable overlapping-shift reasons from a plain API error', async () => {
    mocks.getShiftsByEmployee.mockRejectedValue({ message: 'Review overlapping shifts.', details: { shiftIds: ['shift-a', 'shift-b'] } });
    render(<EmployeeShiftRecords />);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith('Review overlapping shifts. Shift IDs: shift-a, shift-b.'));
  });
  it('edits shift notes without resending dates, rates or recorded wages', async () => {
    mocks.shifts = [historicalShift];
    render(<Shifts />);
    fireEvent.click(document.querySelector('tbody button')!);
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'corrected' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Shift' }));
    await waitFor(() => expect(mocks.updateShift).toHaveBeenCalledWith('shift', { notes: 'corrected' }));
  });
  it('clears employee filters by requesting explicit empty parameters', async () => {
    render(<EmployeeShiftRecords />);
    await screen.findByRole('button', { name: 'Clear' });
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Filter' }));
    await screen.findByRole('button', { name: 'Clear' });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(mocks.getShiftsByEmployee).toHaveBeenLastCalledWith({ startDate: undefined, endDate: undefined }));
  });
  it('cannot report clock-in success before the server acknowledges the selected employee', async () => {
    let acknowledge!: () => void;
    mocks.clockIn.mockImplementation(() => new Promise<void>(resolve => { acknowledge = resolve; }));
    render(<TimeClock />);
    const employeeControl = screen.queryByLabelText('Employee') ?? screen.getByLabelText('Employee ID');
    fireEvent.change(employeeControl, { target: { value: 'employee' } });
    fireEvent.click(screen.getByRole('button', { name: /^Clock In$/i }));
    await waitFor(() => expect(mocks.clockIn).toHaveBeenCalledWith('employee', 'server'));
    expect(mocks.toast).not.toHaveBeenCalled();
    acknowledge();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Success' })));
  });
  it('retains historical POS type, timestamp, source and pooling on a note edit', async () => {
    mocks.tips = [{ id: 'tip', employeeId: 'employee', amount: 40, tipType: 'pos_pooled', source: 'pos', isPooled: true, timestamp: '2026-09-01T22:00:00Z', createdAt: '2026-09-01T22:00:00Z', serverName: 'Ada Test', notes: 'original' }];
    render(<Tips />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit tip tip' }));
    expect(screen.getByLabelText('Recorded At *')).toHaveAttribute('readonly');
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'corrected' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Tip' }));
    await waitFor(() => expect(mocks.updateTip).toHaveBeenCalledWith('tip', { notes: 'corrected' }));
    expect(mocks.updateTip).toHaveBeenCalledTimes(1);
  });
  it('creates a historical linked tip with the explicit received timestamp instead of now', async () => {
    mocks.shifts = [historicalShift];
    render(<Tips />);
    fireEvent.change(screen.getByLabelText('Amount *'), { target: { value: '40' } });
    const selects = screen.getAllByLabelText('Select test value');
    fireEvent.change(selects[1], { target: { value: 'employee' } });
    fireEvent.change(selects[2], { target: { value: 'shift' } });
    fireEvent.change(screen.getByLabelText('Recorded At *'), { target: { value: '2026-09-01T21:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Tip' }));
    await waitFor(() => expect(mocks.createTip).toHaveBeenCalledWith(expect.objectContaining({ timestamp: new Date('2026-09-01T21:00').toISOString(), employeeId: 'employee', shiftId: 'shift', amount: 40 })));
  });
  it('sends amount changes only and keeps an imported type selected', async () => {
    mocks.tips = [{ id: 'tip', employeeId: 'employee', amount: 40, tipType: 'pos_pretax', source: 'csv_import', isPooled: true, timestamp: '2026-09-01T22:00:00Z', createdAt: '2026-09-01T22:00:00Z' }];
    render(<Tips />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit tip tip' }));
    expect(screen.getByText('pos_pretax (recorded type)')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Amount *'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Tip' }));
    await waitFor(() => expect(mocks.updateTip).toHaveBeenCalledWith('tip', { amount: 45 }));
  });
  it('does not show success when a clock action is rejected', async () => {
    mocks.clockIn.mockRejectedValue(new Error('Reopen the payroll period first'));
    render(<TimeClock />);
    fireEvent.change(screen.getByLabelText('Employee'), { target: { value: 'employee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clock In' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Clock action failed', description: 'Reopen the payroll period first', variant: 'destructive' })));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Success' }));
  });
  it('clocks out the selected employee single open shift and rejects ambiguity', async () => {
    mocks.shifts = [{ ...historicalShift, id: 'open', endTime: undefined, status: 'active' }];
    render(<TimeClock />);
    fireEvent.change(screen.getByLabelText('Employee'), { target: { value: 'employee' } });
    expect(screen.getByRole('button', { name: 'Clock In' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Clock Out' }));
    await waitFor(() => expect(mocks.clockOut).toHaveBeenCalledWith('open'));
    cleanup();
    mocks.shifts.push({ ...historicalShift, id: 'another', endTime: undefined, status: 'active' });
    render(<TimeClock />);
    fireEvent.change(screen.getByLabelText('Employee'), { target: { value: 'employee' } });
    expect(screen.getByRole('button', { name: 'Clock Out' })).toBeDisabled();
    expect(screen.queryByText('Sarah Johnson')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start Break' })).not.toBeInTheDocument();
  });
  it('creates a shift with the operator calendar date and without fabricated financial fields', () => {
    const payload = shiftFormRequest({ employeeId: 'employee', startTime: '2026-09-01T23:00', endTime: '2026-09-02T07:00', jobCode: 'server', locationId: 'main', status: 'completed', notes: '' });
    expect(payload.shiftDate).toBe('2026-09-01');
    expect(payload).not.toHaveProperty('hourlyRate');
    expect(payload).not.toHaveProperty('totalWage');
    expect(payload.startTime).toMatch(/Z$/);
  });
  it('derives actual durations and excludes break rows from anomaly inputs', async () => {
    const analysisNow = Date.now();
    const startTime = new Date(analysisNow - 8 * 3_600_000).toISOString();
    const endTime = new Date(analysisNow - 3_600_000).toISOString();
    mocks.shifts = [{ ...historicalShift, startTime, endTime, durationMin: 0 }, { ...historicalShift, startTime, endTime, id: 'break', status: 'break' }];
    render(<LiveErrorDetectionDashboard />);
    fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }));
    expect(mocks.detectAnomalies).toHaveBeenLastCalledWith([expect.objectContaining({ id: 'shift', duration_min: 420 })]);
    expect(shiftDurationMinutes(historicalShift)).toBe(480);
    expect(shiftDurationMinutes({ startTime: '2026-09-01T00:00:00Z' }, Date.parse('2026-09-01T02:00:00Z'))).toBe(120);
    expect(mocks.detectAnomalies.mock.calls.every(([rows]) => rows.every((row: any) => row.id !== 'break'))).toBe(true);
  });
  it('keeps ordinary shift deletion available while removing the mass-delete control', async () => {
    mocks.shifts = [historicalShift];
    render(<Shifts />);
    expect(screen.queryByRole('button', { name: 'Delete All Shifts' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete shift shift' })).toBeInTheDocument();
  });
});
