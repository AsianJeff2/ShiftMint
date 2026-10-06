// @vitest-environment jsdom
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';

const fixture = vi.hoisted(() => ({ user: { role: 'owner', firstName: 'Owner' }, tips: [] as any[], shifts: [] as any[], getTips: vi.fn(), getShifts: vi.fn() }));
vi.mock('@/contexts/LocalAuthContext', () => ({ useLocalAuth: () => ({ user: fixture.user }) }));
vi.mock('@/contexts/DataContext', () => ({ useData: () => ({ tips: fixture.tips, shifts: fixture.shifts, payrollPeriods: [], business: null, loadingTips: false, loadingShifts: false, loadingPayroll: false, getTips: fixture.getTips, getShifts: fixture.getShifts }) }));
vi.mock('@/components/export/ComprehensiveExport', () => ({ ComprehensiveExport: () => null }));
beforeEach(() => {
  vi.clearAllMocks();
  fixture.user = { role: 'owner', firstName: 'Owner' };
  const instant = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600000).toISOString();
  fixture.tips = [{ id: 'old', amount: 100, timestamp: instant(40 * 24), createdAt: instant(40 * 24) }, { id: 'recent', amount: 2, timestamp: instant(48), createdAt: instant(48) }];
  fixture.shifts = [{ id: 'work', status: 'completed', startTime: instant(3), endTime: instant(1) }, { id: 'break', status: 'break', startTime: instant(10), endTime: instant(2) }];
  fixture.getTips.mockImplementation(async () => fixture.tips);
  fixture.getShifts.mockImplementation(async () => fixture.shifts);
});
afterEach(cleanup);

describe('authorized rolling30-day dashboard figures', () => {
  it('clips work to the rolling range and excludes unfinished shifts', async () => {
    const instant = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600000).toISOString();
    fixture.shifts = [{ id: 'overlap', status: 'completed', startTime: instant(30 * 24 + 1), endTime: instant(30 * 24 - 1) }, { id: 'open', status: 'in_progress', startTime: instant(3) }];
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('dashboard-work-hours').textContent).toBe('1.0h'));
  });

  it('marks failed reads unavailable instead of reporting financial zero', async () => {
    fixture.getTips.mockRejectedValue({ userMessage: 'Review provider access before reading tips' });
    fixture.getShifts.mockRejectedValue(new Error('Shift records are unavailable'));
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('dashboard-tip-total').textContent).toBe('Unavailable'));
    expect(screen.getByTestId('dashboard-work-hours').textContent).toBe('Unavailable');
    expect(screen.getByRole('alert').textContent).toContain('Review provider access before reading tips');
  });

  it('excludes old tips and breaks, then resets the totals when records become empty', async () => {
    const view = render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('dashboard-tip-total').textContent).toBe('$2.00'));
    expect(screen.getByTestId('dashboard-work-hours').textContent).toBe('2.0h');
    expect(fixture.getTips).toHaveBeenCalledWith(expect.objectContaining({ startDate: expect.any(String), endDate: expect.any(String) }));
    fixture.tips = []; fixture.shifts = [];
    view.rerender(<MemoryRouter><Dashboard /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('dashboard-tip-total').textContent).toBe('$0.00'));
    expect(screen.getByTestId('dashboard-work-hours').textContent).toBe('0.0h');
  });
  it('does not show zero hours or payroll counts as known facts for staff without access', async () => {
    fixture.user = { role: 'staff', firstName: 'Staff' };
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('dashboard-tip-total').textContent).toBe('$2.00'));
    expect(screen.getByTestId('dashboard-work-hours').textContent).toBe('No access');
    expect(screen.getByTestId('dashboard-payroll-count').textContent).toBe('No access');
    expect(fixture.getShifts).not.toHaveBeenCalled();
  });
});
