// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../../tests/setup';
import { ComprehensiveExport, comprehensiveDateRange } from './ComprehensiveExport';

const fixture = vi.hoisted(() => ({ exportData: vi.fn() }));
vi.mock('@/contexts/DataContext', () => ({ useData: () => ({ exportData: fixture.exportData }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); fixture.exportData.mockResolvedValue(undefined); });
afterEach(cleanup);

describe('comprehensive export review boundaries', () => {
  it('uses full calendar months and quarters without converting their end date to midnight UTC', () => {
    expect(comprehensiveDateRange('lastMonth', '', '', new Date(2024, 2, 15, 12))).toEqual({ startDate: '2024-02-01', endDate: '2024-02-29' });
    expect(comprehensiveDateRange('thisQuarter', '', '', new Date(2026, 10, 15, 12))).toEqual({ startDate: '2026-10-01', endDate: '2026-12-31' });
    expect(() => comprehensiveDateRange('custom', '2026-10-31', '2026-10-01')).toThrow();
    expect(() => comprehensiveDateRange('custom', '2026-02-30', '2026-03-01')).toThrow();
  });

  it('discloses estimates instead of claiming tax filing readiness', () => {
    render(<ComprehensiveExport />);
    fireEvent.click(screen.getByRole('button', { name: 'Comprehensive Export' }));
    expect(screen.queryByText('Tax Filing Ready')).toBeNull();
    expect(screen.getByText(/withholding estimates/i)).toBeTruthy();
    expect(screen.getByText(/not a database recovery backup/i)).toBeTruthy();
  });
  it('sends functional exclusion options and offers only structured JSON', async () => {
    render(<ComprehensiveExport />);
    fireEvent.click(screen.getByRole('button', { name: 'Comprehensive Export' }));
    fireEvent.click(screen.getByLabelText('Employee Details'));
    fireEvent.click(screen.getByLabelText('Tip Breakdown'));
    fireEvent.click(screen.getByLabelText('Payroll Calculations'));
    fireEvent.click(screen.getByRole('button', { name: 'Export Data' }));
    await waitFor(() => expect(fixture.exportData).toHaveBeenCalledWith({ type: 'comprehensive', format: 'json', options: { includeEmployeeDetails: false, includeTipBreakdown: false, includePayrollCalculations: false } }));
    expect(screen.queryByText('CSV (Excel Compatible)')).toBeNull();
  });
  it('uses exact inclusive calendar bounds for a custom month ending on its last day', async () => {
    render(<ComprehensiveExport />);
    fireEvent.click(screen.getByRole('button', { name: 'Comprehensive Export' }));
    fireEvent.change(screen.getByLabelText('Time Period'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-10-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export Data' }));
    await waitFor(() => expect(fixture.exportData).toHaveBeenCalledWith(expect.objectContaining({ startDate: '2026-10-01', endDate: '2026-10-31' })));
  });
});
