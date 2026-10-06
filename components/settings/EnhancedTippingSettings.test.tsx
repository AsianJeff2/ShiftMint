// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../../tests/setup';
import Settings from '@/pages/Settings';
import { defaultTipDistributionSettings } from '@/lib/tip-distribution';

const fixture = vi.hoisted(() => ({ role: 'owner', business: { id: 'business-a', name: 'Venue' }, getSettings: vi.fn(), saveSettings: vi.fn() }));
vi.mock('@/contexts/DataContext', () => ({ useData: () => ({ business: fixture.business, loadingBusiness: false, updateBusiness: vi.fn(), analyticsEnabled: false, updateAnalyticsSettings: vi.fn() }) }));
vi.mock('@/contexts/LocalAuthContext', () => ({ useLocalAuth: () => ({ user: { id: 'user-a', role: fixture.role, firstName: 'Owner' }, changePassword: vi.fn() }) }));
vi.mock('@/lib/api-client', () => ({ default: { getTipDistributionSettings: fixture.getSettings, saveTipDistributionSettings: fixture.saveSettings } }));
vi.mock('@/components/settings/DatabaseBackupSettings', () => ({ DatabaseBackupSettings: () => null }));
vi.mock('@/components/settings/IntegrationsSettings', () => ({ IntegrationsSettings: () => null }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
beforeEach(() => { vi.clearAllMocks(); fixture.role = 'owner'; fixture.getSettings.mockResolvedValue(defaultTipDistributionSettings()); vi.stubGlobal('alert', vi.fn()); fixture.saveSettings.mockResolvedValue({ success: true }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('controlled persisted tip settings', () => {
  it('does not substitute defaults or allow a save when the persisted read fails', async () => {
    fixture.getSettings.mockRejectedValue({ userMessage: 'Stored settings require administrator review' });
    render(<Settings />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Tipping' }), { button: 0, ctrlKey: false });
    await screen.findByText('Stored settings require administrator review');
    expect(screen.getByRole('button', { name: 'Save Tipping Settings' })).toHaveProperty('disabled', true);
    expect(screen.queryByDisplayValue('Front of House')).toBeNull();
    expect(fixture.saveSettings).not.toHaveBeenCalled();
  });

  it('persists controlled rule edits using lowercase employee roles', async () => {
    render(<Settings />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Tipping' }), { button: 0, ctrlKey: false });
    await screen.findByDisplayValue('Front of House');
    fireEvent.change(screen.getByLabelText('Group 1 name'), { target: { value: 'Dining team' } });
    fireEvent.click(screen.getByLabelText('Dining team: busser'));
    fireEvent.change(screen.getByLabelText('Group 1 distribution'), { target: { value: 'equal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Tipping Settings' }));
    await waitFor(() => expect(fixture.saveSettings).toHaveBeenCalledOnce());
    expect(fixture.saveSettings.mock.calls[0][0].distributionRules[0]).toMatchObject({ name: 'Dining team', distributionMethod: 'equal', roles: ['server', 'bartender', 'host', 'busser'] });
  });

  it.each(['staff', 'manager'])('shows only role-allowed settings panels for %s', async role => {
    fixture.role = role;
    render(<Settings />);
    expect(screen.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Business' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Tipping' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Database' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Analytics' })).toBeNull();
    expect(!!screen.queryByRole('tab', { name: 'POS connections' })).toBe(role === 'manager');
    expect(fixture.getSettings).not.toHaveBeenCalled();
  });

  it('lets an admin inspect settings while keeping owner-only changes disabled', async () => {
    fixture.role = 'admin';
    render(<Settings />);
    expect(screen.getByRole('button', { name: 'Update Business Information' }).closest('fieldset')).toHaveProperty('disabled', true);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Tipping' }), { button: 0, ctrlKey: false });
    await screen.findByDisplayValue('Front of House');
    expect(screen.getByRole('button', { name: 'Save Tipping Settings' })).toHaveProperty('disabled', true);
    expect(screen.queryByRole('tab', { name: 'POS connections' })).toBeNull();
  });

  it('uses asynchronously loaded settings and saves the full contract without a businessId', async () => {
    let resolveSettings!: (value: ReturnType<typeof defaultTipDistributionSettings>) => void;
    fixture.getSettings.mockImplementationOnce(() => new Promise(resolve => { resolveSettings = resolve; }));
    const settings = defaultTipDistributionSettings();
    settings.distributionRules[0].name = 'Saved dining team';
    settings.minimumHoursThreshold = 6;
    render(<Settings />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Tipping' }), { button: 0, ctrlKey: false });
    await act(async () => { resolveSettings(settings); });
    expect(screen.getByDisplayValue('Saved dining team')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save Tipping Settings' }));
    await waitFor(() => expect(fixture.saveSettings).toHaveBeenCalledWith(settings));
    expect(fixture.saveSettings.mock.calls[0][0]).not.toHaveProperty('businessId');
    expect(screen.queryByText('By Points')).toBeNull();
    expect(screen.queryByText('POS Integration')).toBeNull();
  });
});
