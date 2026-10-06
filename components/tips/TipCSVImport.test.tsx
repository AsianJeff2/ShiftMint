// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../../tests/setup';
import { TipCSVImport } from './TipCSVImport';
import { TipTypeSchema } from '@/lib/types/api-dtos';

const fixture = vi.hoisted(() => ({ importTips: vi.fn(), getTips: vi.fn(), complete: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock('@/contexts/DataContext', () => ({ useData: () => ({ getTips: fixture.getTips }) }));
vi.mock('@/hooks/useEmployees', () => ({ useEmployees: () => ({ employees: [{ id: 'employee-a', firstName: 'Ada', lastName: 'Test' }] }) }));
vi.mock('@/lib/api-client', () => ({ default: { importTipsFromCSV: fixture.importTips } }));
vi.mock('sonner', () => ({ toast: { success: fixture.success, error: fixture.error, warning: fixture.warning } }));
const upload = (csv: string) => fireEvent.change(screen.getByLabelText('Choose CSV File'), { target: { files: [new File([csv], 'tips.csv', { type: 'text/csv' })] } });
const open = () => { render(<TipCSVImport onImportComplete={fixture.complete} />); fireEvent.click(screen.getByRole('button', { name: 'Import CSV' })); };
const header = 'Amount,Tip Type,Timestamp';
const date = '2026-10-05T09:00:00-04:00';
beforeEach(() => { vi.clearAllMocks(); fixture.importTips.mockResolvedValue({ success: true, imported: 1, errors: [] }); fixture.getTips.mockResolvedValue([]); });
afterEach(cleanup);

describe('canonical tip CSV classifications and occurrence data', () => {
  it('normalizes every supported uppercase classification without converting types to credit', async () => {
    fixture.importTips.mockResolvedValue({ success: true, imported: 9, errors: [] });
    open(); upload(header + '\n' + TipTypeSchema.options.map(type => '12.50, ' + type.toUpperCase() + ' ,' + date).join('\n'));
    await screen.findByText(/9 tips ready for import/);
    fireEvent.click(screen.getByRole('button', { name: 'Import 9 Tips' }));
    await waitFor(() => expect(fixture.importTips).toHaveBeenCalledOnce());
    expect(fixture.importTips.mock.calls[0][0].map((row: any) => row.tipType)).toEqual(TipTypeSchema.options);
    expect(fixture.importTips.mock.calls[0][0].every((row: any) => row.timestamp === '2026-10-05T13:00:00.000Z')).toBe(true);
  });

  it('shows an unknown type as a row error and blocks partial frontend import', async () => {
    open(); upload(header + '\n10,credit,' + date + '\n5,mystery,' + date);
    await screen.findByText(/Row 3: Unsupported tip type/);
    expect(screen.getByRole('button', { name: 'Import 1 Tips' })).toBeDisabled();
    expect(fixture.importTips).not.toHaveBeenCalled();
  });

  it('rejects an empty supplied classification while documenting only the absent-column default', async () => {
    open(); upload(header + '\n10,,' + date);
    await screen.findByText(/Row 2: Tip type is required when its column is present/);
    expect(screen.getByRole('button', { name: 'Import 0 Tips' })).toBeDisabled();
    upload('Amount,Timestamp\n10,' + date);
    await screen.findByText(/1 tips ready for import/);
    expect(screen.getByText(/When the Tip Type column is absent, tips use credit/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 Tips' }));
    await waitFor(() => expect(fixture.importTips).toHaveBeenCalledWith([expect.objectContaining({ tipType: 'credit' })]));
  });

  it.each(['', '2026-10-05 09:00:00', '2026-02-30T09:00:00Z', '2026-10-05T09:00:00+25:00'])('rejects missing or ambiguous occurrence timestamp %s', async timestamp => {
    open(); upload(header + '\n10,cash,' + timestamp);
    await screen.findByText(/Row 2: .*timestamp|Row 2: .*ISO|Row 2: .*calendar|Row 2: .*offset/i);
    expect(screen.getByRole('button', { name: 'Import 0 Tips' })).toBeDisabled();
    expect(fixture.importTips).not.toHaveBeenCalled();
  });

  it.each(['12oops', 'Infinity', '-2', '0', '$$5', '5$'])('rejects malformed/nonpositive amount %s without changing its financial value', async amount => {
    open(); upload(header + '\n' + amount + ',cash,' + date);
    await screen.findByText(/Row 2: Invalid tip amount format/);
    expect(screen.getByRole('button', { name: 'Import 0 Tips' })).toBeDisabled();
    expect(fixture.importTips).not.toHaveBeenCalled();
  });

  it('keeps quoted currency, commas and escaped quotes intact', async () => {
    open(); upload(header + ',Notes\n"$1,234.50",TABLE_SERVER,' + date + ',"Dinner, table ""A"""');
    await screen.findByText(/1 tips ready for import/);
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 Tips' }));
    await waitFor(() => expect(fixture.importTips).toHaveBeenCalledWith([expect.objectContaining({ amount: '1234.5', tipType: 'table_server', notes: 'Dinner, table "A"' })]));
  });

  it('preserves a positive fractional dollar value without a leading zero', async () => {
    open(); upload(header + '\n.50,hourly,' + date);
    await screen.findByText(/1 tips ready for import/);
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 Tips' }));
    await waitFor(() => expect(fixture.importTips).toHaveBeenCalledWith([expect.objectContaining({ amount: '0.5', tipType: 'hourly' })]));
  });

  it('rejects duplicate classification columns instead of overwriting one type with another', async () => {
    open(); upload(header + ',Type\n10,cash,' + date + ',credit');
    await screen.findByText('CSV has duplicate columns for the same tip field');
    expect(screen.getByRole('button', { name: 'Import 0 Tips' })).toBeDisabled();
    expect(fixture.importTips).not.toHaveBeenCalled();
  });
});

describe('truthful tip CSV acknowledgements', () => {
  it('clears an unconfirmed submitted payload and asks the operator to inspect records before a new upload', async () => {
    fixture.importTips.mockRejectedValue({ userMessage: 'Connection failed after submission' });
    open(); upload(header + '\n10,cash,' + date);
    await screen.findByText(/1 tips ready for import/);
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 Tips' }));
    await screen.findByText(/some rows may already be saved/);
    expect(screen.getByText('Connection failed after submission')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 0 Tips' })).toBeDisabled();
    expect(fixture.importTips).toHaveBeenCalledOnce();
    expect(fixture.getTips).not.toHaveBeenCalled();
  });

  it.each([0, 1])('retains server row errors after %s rows import and prevents a duplicate retry', async imported => {
    fixture.importTips.mockResolvedValue({ success: true, imported, errors: [{ row: 2, error: 'Payroll period is closed' }] });
    open(); upload(header + '\n10,cash,' + date + '\n5,bulk,' + date);
    await screen.findByText(/2 tips ready for import/);
    fixture.success.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 Tips' }));
    await screen.findByText('CSV row 3: Payroll period is closed');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 0 Tips' })).toBeDisabled();
    expect(fixture.getTips).toHaveBeenCalledTimes(imported ? 1 : 0);
    expect(fixture.complete).toHaveBeenCalledTimes(imported ? 1 : 0);
    if (!imported) expect(fixture.success).not.toHaveBeenCalled();
  });

  it('does not leave a previous valid file queued when a replacement file is invalid', async () => {
    open(); upload(header + '\n10,cash,' + date);
    await screen.findByText(/1 tips ready for import/);
    upload('Amount,Tip Type,Timestamp');
    await waitFor(() => expect(fixture.error).toHaveBeenCalledWith(expect.stringContaining('header row and one data row')));
    expect(screen.getByRole('button', { name: 'Import 0 Tips' })).toBeDisabled();
  });
});
