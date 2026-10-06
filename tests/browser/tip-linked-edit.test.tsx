// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../setup';
import Tips from '../../pages/Tips';
import { toTipEntryDTO } from '../../lib/transformers/tipTransformer';

const mocks = vi.hoisted(() => ({ getTips: vi.fn(), updateTip: vi.fn().mockResolvedValue(undefined), createTip: vi.fn(), toast: vi.fn(), tips: [] as any[] }));
vi.mock('@/contexts/DataContext', () => ({ useData: () => ({
  ...mocks, loadingTips: false,
  employees: [{ id: 'employee', firstName: 'Ada', lastName: 'Fixture', status: 'active', role: 'server' }],
  shifts: [{ id: 'shift', employeeId: 'employee', status: 'completed', startTime: '2026-09-05T16:00:00Z', endTime: '2026-09-06T00:00:00Z' }],
}) }));
vi.mock('sonner', () => ({ toast: { success: mocks.toast, error: mocks.toast } }));
vi.mock('@/components/tips/TipCSVImport', () => ({ TipCSVImport: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('real select initialization with a linked API tip', () => {
  it.each(['pos_pretax', 'pos_posttax', 'pos_pooled', 'hourly', 'table_server', 'bulk'])('preserves recorded %s during real select hydration and a note edit', async tipType => {
    mocks.tips = [toTipEntryDTO({
      id: 'tip', businessId: 'business', employeeId: 'employee', shiftId: 'shift', amount: 20,
      tipType, source: 'csv_import', isPooled: tipType === 'pos_pooled', serverName: 'Ada Fixture', notes: 'original',
      timestamp: '2026-09-06T16:00:00Z', createdAt: '2026-10-06T02:00:00Z', updatedAt: '2026-10-06T02:00:00Z',
    } as any)];
    mocks.getTips.mockImplementation(async () => mocks.tips);
    render(<Tips />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit tip tip' }));
    await waitFor(() => expect(screen.getAllByRole('combobox')[0]).toHaveTextContent(tipType));
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'classification preserved' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Tip' }));
    await waitFor(() => expect(mocks.updateTip).toHaveBeenCalledWith('tip', { notes: 'classification preserved' }));
  });
  it('shows the existing shift and changes only notes without unlinking', async () => {
    mocks.tips = [toTipEntryDTO({
      id: 'tip', businessId: 'business', employeeId: 'employee', shiftId: 'shift', amount: 40,
      tipType: 'credit', source: 'manual', isPooled: false, serverName: 'Ada Fixture', notes: 'original',
      timestamp: '2026-09-05T19:00:00Z', createdAt: '2026-10-06T02:00:00Z', updatedAt: '2026-10-06T02:00:00Z',
    } as any)];
    mocks.getTips.mockImplementation(async () => mocks.tips);
    render(<Tips />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit tip tip' }));
    await waitFor(() => expect(screen.getAllByRole('combobox')[2]).toHaveTextContent('Sep 5, 2026'));
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'corrected' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Tip' }));
    await waitFor(() => expect(mocks.updateTip).toHaveBeenCalledWith('tip', { notes: 'corrected' }));
  });
  it('unlinks only after the explicit removal action', async () => {
    mocks.tips = [toTipEntryDTO({
      id: 'tip', businessId: 'business', employeeId: 'employee', shiftId: 'shift', amount: 40,
      tipType: 'credit', source: 'manual', isPooled: false, serverName: 'Ada Fixture', notes: 'original',
      timestamp: '2026-09-05T19:00:00Z', createdAt: '2026-10-06T02:00:00Z', updatedAt: '2026-10-06T02:00:00Z',
    } as any)];
    mocks.getTips.mockImplementation(async () => mocks.tips);
    render(<Tips />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit tip tip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove shift link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update Tip' }));
    await waitFor(() => expect(mocks.updateTip).toHaveBeenCalledWith('tip', { shiftId: '' }));
  });
});
