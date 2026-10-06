// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../../tests/setup';
import { EmployeeList } from '../../components/employees/EmployeeList';
import Settings from '../../pages/Settings';

const mocks = vi.hoisted(() => ({ createEmployee: vi.fn(), updateEmployee: vi.fn(), updateBusiness: vi.fn(), getSettings: vi.fn().mockResolvedValue({}), toast: vi.fn(), business: { id: 'business', name: 'Stored EIN Business', type: 'restaurant', einStored: true, address: null } }));
vi.mock('@/hooks/useEmployees', () => ({ useEmployees: () => ({ employees: [{ id: 'employee', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', hourlyRate: 20, overtimeRate: 30, role: 'server', startDate: '2026-01-01', status: 'active', tipEligible: true, payType: 'hourly', taxExemptions: 0 }], loading: false, createEmployee: mocks.createEmployee, updateEmployee: mocks.updateEmployee }) }));
vi.mock('@/contexts/DataContext', () => ({ useData: () => ({ business: mocks.business, loadingBusiness: false, updateBusiness: mocks.updateBusiness }) }));
vi.mock('@/contexts/LocalAuthContext', () => ({ useLocalAuth: () => ({ user: { role: 'owner', firstName: 'Owner', lastName: 'Test' } }) }));
vi.mock('@/lib/api-client', () => ({ default: { getTipDistributionSettings: mocks.getSettings } }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/settings/DatabaseBackupSettings', () => ({ DatabaseBackupSettings: () => null }));
vi.mock('@/components/settings/EnhancedTippingSettings', () => ({ EnhancedTippingSettings: () => null }));
vi.mock('@/components/settings/IntegrationsSettings', () => ({ IntegrationsSettings: () => null }));
vi.mock('@/components/employees/EmployeeCSVImport', () => ({ EmployeeCSVImport: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('alert', vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('redacted sensitive fields during ordinary edits', () => {
  it('submits a capitalized role using the API contract and rejects a zero rate', async () => {
    render(<EmployeeList />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Employee' }));
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Grace' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'grace@example.test' } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: ' Server ' } });
    fireEvent.change(screen.getByLabelText('Hourly Rate'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Hourly rate must be positive');
    expect(mocks.createEmployee).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Hourly Rate'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.createEmployee).toHaveBeenCalledTimes(1));
    expect(mocks.createEmployee.mock.calls[0][0]).toMatchObject({ role: 'server', hourlyRate: 20 });
  });
  it('edits a name without submitting empty bank fields', async () => {
    render(<EmployeeList />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada Lovelace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.updateEmployee).toHaveBeenCalledTimes(1));
    expect(mocks.updateEmployee.mock.calls[0][1]).not.toHaveProperty('bankAccountNumber');
    expect(mocks.updateEmployee.mock.calls[0][1]).not.toHaveProperty('bankRoutingNumber');
  });
  it('preserves stored EIN on a contact edit and submits an explicit replacement', async () => {
    render(<Settings />);
    expect(screen.getByLabelText('Business Address')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Update Business Information' }));
    await waitFor(() => expect(mocks.updateBusiness).toHaveBeenCalledTimes(1));
    expect(mocks.updateBusiness.mock.calls[0][0]).not.toHaveProperty('ein');
    expect(mocks.updateBusiness.mock.calls[0][0]).toHaveProperty('address', '');
    fireEvent.change(screen.getByLabelText('EIN / Tax ID'), { target: { value: '12-3456789' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Business Information' }));
    await waitFor(() => expect(mocks.updateBusiness).toHaveBeenCalledTimes(2));
    expect(mocks.updateBusiness.mock.calls[1][0]).toHaveProperty('ein', '12-3456789');
  });
});
