// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../setup';
import { DatabaseBackupSettings } from '../../components/settings/DatabaseBackupSettings';

const mocks = vi.hoisted(() => ({ createBackup: vi.fn(), loadBackups: vi.fn(), loadDatabaseInfo: vi.fn(), clearError: vi.fn(), error: null as string | null }));
vi.mock('@/hooks/useDatabase', () => ({ useDatabase: () => ({ loading: false, error: mocks.error, backups: [], databaseInfo: null, createBackup: mocks.createBackup, loadBackups: mocks.loadBackups, loadDatabaseInfo: mocks.loadDatabaseInfo, clearError: mocks.clearError, restoreFromBackup: vi.fn(), deleteBackup: vi.fn() }) }));
vi.mock('@/lib/api-client', () => ({ default: {} }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.error = null;
  mocks.loadBackups.mockResolvedValue([]);
  mocks.loadDatabaseInfo.mockResolvedValue({});
  mocks.createBackup.mockResolvedValue({ name: 'before-payroll.db' });
  delete (window as unknown as Record<string, unknown>).electronAPI;
});
afterEach(cleanup);

describe('database backup controls', () => {
  it('adds .db to a simple label before creating a backup', async () => {
    render(<DatabaseBackupSettings />);
    fireEvent.change(screen.getByLabelText('Custom Backup Name (Optional)'), { target: { value: 'before-payroll' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Backup' }));
    await waitFor(() => expect(mocks.createBackup).toHaveBeenCalledWith('before-payroll.db'));
  });

  it.each(['../outside', 'backup.sqlite', 'C:\\outside.db', 'NUL.db'])('rejects unsafe label %s without calling the API', async label => {
    render(<DatabaseBackupSettings />);
    fireEvent.change(screen.getByLabelText('Custom Backup Name (Optional)'), { target: { value: label } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Backup' }));
    expect(await screen.findByText(/Paths and other file extensions are not allowed/)).toBeVisible();
    expect(mocks.createBackup).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Create Backup' })).toBeEnabled();
  });

  it('keeps retry controls present after an operation error', () => {
    mocks.error = 'Temporary server failure';
    render(<DatabaseBackupSettings />);
    expect(screen.getByText('Temporary server failure')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create Backup' })).toBeEnabled();
    expect(screen.getByLabelText('Custom Backup Name (Optional)')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(mocks.clearError).toHaveBeenCalledOnce();
  });

  it('disables local file import with an operator explanation in a browser', () => {
    render(<DatabaseBackupSettings />);
    expect(screen.getByRole('button', { name: 'Select Backup File to Import' })).toBeDisabled();
    expect(screen.getByText(/Selecting a local backup file requires the desktop app/)).toBeVisible();
  });
});
