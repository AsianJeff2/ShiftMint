// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../setup';
import { ShiftCSVImport } from '../../components/shifts/ShiftCSVImport';
const mocks = vi.hoisted(() => ({ importShifts: vi.fn(), getShifts: vi.fn(), getEmployees: vi.fn(), success: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: { importShiftsFromCSV: mocks.importShifts } }));
vi.mock('@/contexts/DataContext', () => ({ useData: () => ({ getShifts: mocks.getShifts, getEmployees: mocks.getEmployees }) }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: vi.fn(), info: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); mocks.importShifts.mockResolvedValue({ success: true, imported: 1 }); });
afterEach(cleanup);
const header = 'Employee Name,Start Date,End Date';
const upload = (csv: string) => fireEvent.change(screen.getByLabelText('Choose CSV File'), { target: { files: [new File([csv], 'verified.csv', { type: 'text/csv' })] } });
describe('shift CSV preview acknowledgement', () => {
  it('clears the submitted payload when a response is unconfirmed instead of offering duplicate retry', async () => {
    mocks.importShifts.mockRejectedValue(new Error('Connection lost'));
    render(<ShiftCSVImport />);
    fireEvent.click(screen.getByRole('button', { name: 'Import CSV' }));
    upload(`${header}\nAda Test,2026-09-06T09:00:00Z,2026-09-06T17:00:00Z`);
    await screen.findByText('1 valid shifts ready to import');
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 Shifts' }));
    await screen.findByText(/Import result was not confirmed/);
    expect(screen.getByRole('button', { name: 'Import 0 Shifts' })).toBeDisabled();
    expect(mocks.importShifts).toHaveBeenCalledTimes(1);
  });
  it('keeps zero-import server rejection visible without claiming success or closing', async () => {
    mocks.importShifts.mockResolvedValue({ success: true, imported: 0, errors: ['Row 1: historical row rejected'] });
    render(<ShiftCSVImport />);
    fireEvent.click(screen.getByRole('button', { name: 'Import CSV' }));
    upload(`${header}\nAda Test,2026-09-06T09:00:00Z,2026-09-06T17:00:00Z`);
    await screen.findByText('1 valid shifts ready to import');
    mocks.success.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 Shifts' }));
    await screen.findByText('Row 1: historical row rejected');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.getShifts).not.toHaveBeenCalled();
  });
  it('refreshes actual partial imports but retains rejected rows and prevents duplicate retry', async () => {
    mocks.importShifts.mockResolvedValue({ success: true, imported: 1, errors: ['Row 2: overlap requires review'] });
    render(<ShiftCSVImport />);
    fireEvent.click(screen.getByRole('button', { name: 'Import CSV' }));
    upload(`${header}\nAda Test,2026-09-06T09:00:00Z,2026-09-06T17:00:00Z\nGrace Test,2026-09-07T09:00:00Z,2026-09-07T17:00:00Z`);
    await screen.findByText('2 valid shifts ready to import');
    mocks.success.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 Shifts' }));
    await screen.findByText('Row 2: overlap requires review');
    await waitFor(() => expect(mocks.getShifts).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 0 Shifts' })).toBeDisabled();
    expect(mocks.success).toHaveBeenCalledWith('Successfully imported 1 shifts!');
  });
  it('shows row errors and blocks partial import until the source file is corrected', async () => {
    render(<ShiftCSVImport />);
    fireEvent.click(screen.getByRole('button', { name: 'Import CSV' }));
    upload(`${header}\nAda Test,2026-10-05T09:00:00Z,2026-10-05T17:00:00Z\nGrace Test,invalid,2026-10-05T17:00:00Z`);
    await screen.findByText(/Row 3: Use an ISO date/);
    expect(screen.getByRole('button', { name: 'Import 1 Shifts' })).toBeDisabled();
    expect(mocks.importShifts).not.toHaveBeenCalled();
  });
  it('imports only real timestamp rows after group headings and refreshes on server acknowledgement', async () => {
    render(<ShiftCSVImport />);
    fireEvent.click(screen.getByRole('button', { name: 'Import CSV' }));
    upload(`${header}\nAda Test\n,2026-10-05T09:00:00-04:00,2026-10-05T17:00:00-04:00`);
    await screen.findByText('1 valid shifts ready to import');
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 Shifts' }));
    await waitFor(() => expect(mocks.importShifts).toHaveBeenCalledWith([expect.objectContaining({ employeeName: 'Ada Test', startTime: '2026-10-05T13:00:00.000Z' })]));
    await waitFor(() => expect(mocks.getShifts).toHaveBeenCalledTimes(1));
  });
});
