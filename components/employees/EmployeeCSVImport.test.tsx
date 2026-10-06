// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../../tests/setup';
import { EmployeeCSVImport } from './EmployeeCSVImport';

const fixture = vi.hoisted(() => ({ importRows: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn(), complete: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: { importEmployeesFromCSV: fixture.importRows } }));
vi.mock('sonner', () => ({ toast: { success: fixture.success, error: fixture.error, warning: fixture.warning } }));
const header = 'First Name,Last Name,Email,Phone,Hourly Rate,Role,Department,Tip Eligible,Start Date';
const row = (name: string, eligible: string, date = '2020-01-15') => `${name},Tester,${name.toLowerCase()}@example.test,,20,server,food service,${eligible},${date}`;
function upload(csv: string) {
  const file = new File([csv], 'employees.csv', { type: 'text/csv' });
  Object.assign(file, { fixtureText: csv });
  fireEvent.change(screen.getByLabelText('Choose CSV File'), { target: { files: [file] } });
}
beforeEach(() => {
  vi.clearAllMocks();
  fixture.importRows.mockResolvedValue({ success: true, imported: 2, failed: 0, errors: [] });
  vi.stubGlobal('FileReader', class {
    onload: ((event: unknown) => void) | null = null;
    readAsText(file: File & { fixtureText: string }) { this.onload?.({ target: { result: file.fixtureText } }); }
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function open() { render(<EmployeeCSVImport onImportComplete={fixture.complete} />); fireEvent.click(screen.getByRole('button', { name: 'Import CSV' })); }
describe('employee CSV contract', () => {
  it('normalizes explicit template true and false values before submission', async () => {
    open(); upload(`${header}\n${row('Ada', 'true')}\n${row('Bo', 'FALSE')}`);
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 Employees' }));
    await waitFor(() => expect(fixture.importRows).toHaveBeenCalled());
    expect(fixture.importRows.mock.calls[0][0]).toMatchObject([{ tipEligible: true, startDate: '2020-01-15' }, { tipEligible: false, startDate: '2020-01-15' }]);
  });
  it('preserves quoted commas, escaped literal quotes and embedded newlines', async () => {
    open(); upload(`${header}\n"A""da",Tester,ada@example.test,,20,server,"Kitchen, Prep",true,2020-01-15\nBo,Tester,bo@example.test,,20,server,"Line one\nLine two",false,2020-01-15`);
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 Employees' }));
    await waitFor(() => expect(fixture.importRows).toHaveBeenCalled());
    expect(fixture.importRows.mock.calls[0][0]).toMatchObject([{ firstName: 'A"da', department: 'Kitchen, Prep' }, { department: 'Line one\nLine two' }]);
  });
  it('rejects missing, ambiguous and impossible hire dates before any request', () => {
    open(); upload(`${header}\n${row('Ada', 'true', '')}\n${row('Bo', 'true', '10/12/2020')}\n${row('Cy', 'true', '2020-02-30')}`);
    expect(screen.getByRole('button', { name: /Import \d+ Employees/ })).toBeDisabled();
    expect(screen.getByText(/Validation Errors/)).toBeInTheDocument();
    expect(fixture.importRows).not.toHaveBeenCalled();
  });
  it('rejects unknown boolean values, missing required columns and malformed quotes', () => {
    open(); upload(`${header}\n${row('Ada', 'yes')}`);
    expect(screen.getByRole('button', { name: /Import \d+ Employees/ })).toBeDisabled();
    upload('First Name,Last Name,Email,Hourly Rate\nAda,Tester,ada@example.test,20');
    expect(screen.getByRole('button', { name: /Import \d+ Employees/ })).toBeDisabled();
    upload(`${header}\n"unterminated`);
    expect(screen.getByRole('button', { name: /Import \d+ Employees/ })).toBeDisabled();
  });
  it('retains a zero-import response and its row errors without claiming success', async () => {
    fixture.importRows.mockResolvedValue({ success: true, imported: 0, failed: 1, errors: [{ row: 1, error: 'Duplicate email' }] });
    open(); upload(`${header}\n${row('Ada', 'true')}`);
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 Employees' }));
    await screen.findByText(/Duplicate email/);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Ada Tester')).toBeInTheDocument();
    expect(fixture.success).not.toHaveBeenCalledWith('Successfully imported 0 employees!');
    expect(fixture.complete).not.toHaveBeenCalled();
  });
  it('acknowledges partial imports and retains only rejected rows without duplicate retries', async () => {
    fixture.importRows.mockResolvedValue({ success: true, imported: 1, failed: 1, errors: [{ row: 2, error: 'Duplicate email' }] });
    open(); upload(`${header}\n${row('Ada', 'true')}\n${row('Bo', 'false')}`);
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 Employees' }));
    await screen.findByText(/Duplicate email/);
    expect(screen.queryByText('Ada Tester')).not.toBeInTheDocument();
    expect(screen.getByText('Bo Tester')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 1 Employees' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 Employees' }));
    expect(fixture.importRows).toHaveBeenCalledTimes(1);
    expect(fixture.complete).toHaveBeenCalledTimes(1);
  });
  it('clears the submitted payload after an unknown request outcome instead of retrying it', async () => {
    fixture.importRows.mockRejectedValue(new Error('Connection interrupted after sending'));
    open(); upload(`${header}\n${row('Ada', 'true')}`);
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 Employees' }));
    await screen.findByText('The import outcome is unknown. Inspect saved employees before uploading a new file.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('Ada Tester')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 0 Employees' })).toBeDisabled();
    expect(fixture.importRows).toHaveBeenCalledTimes(1);
    expect(fixture.complete).not.toHaveBeenCalled();
  });
});
