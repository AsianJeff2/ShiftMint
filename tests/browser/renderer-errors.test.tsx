// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import '../setup';
import AuthPage from '../../components/auth/AuthPage';
import Login from '../../pages/Login';
import { useDatabase } from '../../hooks/useDatabase';

const fixture = vi.hoisted(() => ({ login: vi.fn(), setup: vi.fn(), createDatabaseBackup: vi.fn(), listDatabaseBackups: vi.fn(), restoreDatabaseFromBackup: vi.fn(), restoreDatabaseFromFile: vi.fn(), deleteDatabaseBackup: vi.fn(), getDatabaseInfo: vi.fn() }));
vi.mock('@/contexts/LocalAuthContext', () => ({ useLocalAuth: () => ({ login: fixture.login, setup: fixture.setup, loading: false }) }));
vi.mock('@/lib/api-client', () => ({ default: fixture }));
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

describe('actionable plain API errors', () => {
  for (const page of ['auth', 'login'] as const) {
    it(`preserves the server sign-in reason on the ${page} form`, async () => {
      fixture.login.mockRejectedValue({ message: 'Invalid credentials.', userMessage: 'Sign-in is temporarily rate limited. Try again later.' });
      render(page === 'auth' ? <AuthPage /> : <Login />);
      fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'fixture@example.test' } });
      fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'FixturePassword1!' } });
      fireEvent.submit(screen.getByLabelText(/^Email/).closest('form')!);
      expect(await screen.findByText('Sign-in is temporarily rate limited. Try again later.')).toBeInTheDocument();
    });
  }
  it.each([
    ['createBackup', 'createDatabaseBackup'], ['loadBackups', 'listDatabaseBackups'],
    ['restoreFromBackup', 'restoreDatabaseFromBackup'], ['restoreFromFile', 'restoreDatabaseFromFile'],
    ['deleteBackup', 'deleteDatabaseBackup'], ['loadDatabaseInfo', 'getDatabaseInfo'],
  ] as const)('preserves server recovery reasons in %s hook state and rejection', async (action, endpoint) => {
    const reason = 'Backup encryption key does not match.';
    fixture[endpoint].mockRejectedValue({ message: reason });
    const hook = renderHook(useDatabase);
    let failure: unknown;
    await act(async () => { try { await hook.result.current[action]('fixture.db'); } catch (error) { failure = error; } });
    expect(hook.result.current.error).toBe(reason);
    expect(failure).toMatchObject({ message: reason });
  });
});
