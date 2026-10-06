// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalAuthProvider, useLocalAuth } from '../../contexts/LocalAuthContext';

const api = vi.hoisted(() => ({
  healthCheck: vi.fn(async () => undefined),
  checkSetup: vi.fn(async () => ({ needsSetup: false })),
  getCurrentUser: vi.fn(async () => ({ user: {
    id: 'test-user', businessId: 'test-business', firstName: 'Test', lastName: 'User',
    email: 'test@example.invalid', role: 'owner',
  } })),
  setToken: vi.fn(),
  logout: vi.fn(async () => undefined),
  changePassword: vi.fn(async () => ({ requiresLogin: true })),
  login: vi.fn(),
  setup: vi.fn(),
}));
vi.mock('../../lib/api-client', () => ({ default: api }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('auth_token', 'test-session');
});
afterEach(() => { cleanup(); localStorage.clear(); });

async function signedInSession() {
  const hook = renderHook(() => useLocalAuth(), {
    wrapper: ({ children }: { children: React.ReactNode }) => <LocalAuthProvider>{children}</LocalAuthProvider>,
  });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.user?.id).toBe('test-user');
  return hook;
}

describe('desktop and web authentication session transitions', () => {
  it('revokes the server session before clearing local authentication on logout', async () => {
    const hook = await signedInSession();
    await act(async () => { await hook.result.current.logout(); });
    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(api.setToken).toHaveBeenLastCalledWith(null);
    expect(hook.result.current.user).toBeNull();
  });

  it('clears local authentication even if the logout request cannot reach the server', async () => {
    const hook = await signedInSession();
    api.logout.mockRejectedValueOnce(new Error('Offline'));
    let error: unknown;
    await act(async () => {
      try { await hook.result.current.logout(); } catch (cause) { error = cause; }
    });
    expect(error).toBeInstanceOf(Error);
    expect(api.setToken).toHaveBeenLastCalledWith(null);
    expect(hook.result.current.user).toBeNull();
  });

  it('requires a fresh login after a successful password change', async () => {
    const hook = await signedInSession();
    await act(async () => { await hook.result.current.changePassword('old-test-password', 'new-test-password'); });
    expect(api.changePassword).toHaveBeenCalledWith('old-test-password', 'new-test-password');
    expect(api.setToken).toHaveBeenLastCalledWith(null);
    expect(hook.result.current.user).toBeNull();
    expect(hook.result.current.requiresSetup).toBe(false);
  });

  it('preserves the active session when a password change is rejected', async () => {
    const hook = await signedInSession();
    api.changePassword.mockRejectedValueOnce(new Error('Current password is incorrect'));
    await act(async () => {
      try { await hook.result.current.changePassword('wrong-test-password', 'new-test-password'); } catch { /* UI handles rejection. */ }
    });
    expect(hook.result.current.user?.id).toBe('test-user');
    expect(hook.result.current.error).toBeNull();
    expect(api.setToken).not.toHaveBeenCalledWith(null);
  });

  it('keeps credential errors local to the login form so it can retry', async () => {
    const hook = await signedInSession();
    api.login.mockRejectedValueOnce(new Error('Invalid credentials'));
    let error: unknown;
    await act(async () => {
      try { await hook.result.current.login('test@example.invalid', 'wrong-test-password'); }
      catch (cause) { error = cause; }
    });
    expect(error).toBeInstanceOf(Error);
    expect(hook.result.current.error).toBeNull();
  });
});
