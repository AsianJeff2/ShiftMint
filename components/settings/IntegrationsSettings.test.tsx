// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const fixture = vi.hoisted(() => ({ list: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), preview: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: { getPosConnections: fixture.list, connectPos: fixture.connect, disconnectPos: fixture.disconnect, previewPos: fixture.preview } }));
import { IntegrationsSettings } from './IntegrationsSettings';

const connection = { provider: 'square', environment: 'sandbox', status: 'validated', locations: [{ id: 'L1', name: 'Restaurant', currency: 'USD' }], validatedAt: '2026-10-05T00:00:00Z', warnings: [] };
beforeEach(() => { vi.clearAllMocks(); fixture.list.mockResolvedValue({ success: true, data: [connection] }); });
afterEach(() => { cleanup(); });

describe('POS settings failure and preview behavior', () => {
  it('displays a structured API permission error and reloads the persisted connection status', async () => {
    fixture.list.mockResolvedValueOnce({ success: true, data: [connection] }).mockResolvedValue({ success: true, data: [{ ...connection, status: 'needs_attention' }] });
    fixture.preview.mockRejectedValue({ type: 'CLIENT', message: 'These credentials do not grant access to the requested location or read scope.', status: 422 });
    render(<IntegrationsSettings />);
    await screen.findByText('Validated');
    expect(screen.getByText(/Verona POS support is not implemented/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Verona POS documentation' }).getAttribute('href')).toBe('https://doc.veronapos.com/en');
    expect(Array.from(screen.getByLabelText('Provider').querySelectorAll('option')).map(option => option.value)).toEqual(['square', 'toast']);
    await userEvent.click(screen.getByRole('button', { name: 'Fetch preview' }));
    await screen.findByText('These credentials do not grant access to the requested location or read scope.');
    await screen.findByText('Needs attention');
    expect(fixture.list).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('The POS request failed.')).toBeNull();
  });

  it('keeps the original 403 action message if the metadata reload also fails', async () => {
    fixture.list.mockResolvedValueOnce({ success: true, data: [connection] }).mockRejectedValue({ type: 'AUTHORIZATION', message: 'Access denied' });
    fixture.preview.mockRejectedValue({ type: 'AUTHORIZATION', message: 'Owner or manager access is required for POS connections.', status: 403 });
    render(<IntegrationsSettings />); await screen.findByText('Validated');
    await userEvent.click(screen.getByRole('button', { name: 'Fetch preview' }));
    await screen.findByText('Owner or manager access is required for POS connections.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fetch preview' })).not.toHaveProperty('disabled', true));
  });

  it('clears the password field after successful server validation and saves no credentials in browser storage', async () => {
    fixture.connect.mockResolvedValue({ success: true, data: connection });
    render(<IntegrationsSettings />); await screen.findByText('Validated');
    const token = screen.getByLabelText('Square merchant access token') as HTMLInputElement;
    await userEvent.type(token, 'merchant-token-private');
    await userEvent.click(screen.getByRole('button', { name: 'Validate and save connection' }));
    await screen.findByText('Provider credentials and location access validated.');
    expect(token.value).toBe('');
    expect(fixture.connect).toHaveBeenCalledWith({ provider: 'square', environment: 'sandbox', accessToken: 'merchant-token-private' });
    expect(JSON.stringify({ ...localStorage })).not.toContain('merchant-token-private');
  });
});
