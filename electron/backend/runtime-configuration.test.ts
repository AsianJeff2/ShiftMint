import { afterEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import type { Response } from 'express';
import type { AuthenticatedRequest } from './types/express';

const fixture = vi.hoisted(() => ({ businessCount: vi.fn() }));
vi.mock('./database', () => ({
  getPrismaClient: () => ({ business: { count: fixture.businessCount } }),
  registerDatabaseMaintenanceDrain: vi.fn(),
  createDatabaseBackup: vi.fn(), restoreDatabaseFromBackup: vi.fn(), deleteDatabaseBackup: vi.fn(),
  getDatabasePath: vi.fn(), getBackupsDirectory: vi.fn(), listDatabaseBackups: vi.fn(),
  isDatabaseMaintenanceInProgress: () => false,
}));
vi.mock('../../lib/infrastructure/Logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../lib/infrastructure/ConfigurationService', () => ({ config: { get: () => 'fixture-signing-key', isTest: () => true } }));
vi.mock('./services/analytics-scheduler', () => ({ scheduleAnalyticsCollection: vi.fn(), stopAnalyticsCollection: vi.fn() }));
import app, { startBackendServer, validateRuntimeSecrets } from './server';
import { requireDesktopToken } from './middleware/api-security';

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe('explicit backend runtime mode', () => {
  it.each([undefined, '', 'WEB', 'hosted', 'desktop '])('refuses %s before opening a listener or reading the database', async mode => {
    vi.stubEnv('SHIFTMINT_RUNTIME', mode);
    const listen = vi.spyOn(app, 'listen').mockImplementation(() => { throw new Error('Listener must not be opened'); });

    await expect(startBackendServer()).rejects.toThrow('SHIFTMINT_RUNTIME must be exactly web or desktop');
    expect(listen).not.toHaveBeenCalled();
    expect(fixture.businessCount).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'WEB', 'hosted'])('does not bypass the desktop capability middleware for %s', mode => {
    vi.stubEnv('SHIFTMINT_RUNTIME', mode);
    const json = vi.fn(); const status = vi.fn(() => ({ json })); const next = vi.fn();

    requireDesktopToken({ get: () => undefined } as AuthenticatedRequest, { status } as unknown as Response, next);
    expect(status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts explicit desktop mode and still requires its capability on requests', () => {
    vi.stubEnv('SHIFTMINT_RUNTIME', 'desktop');
    vi.stubEnv('SHIFTMINT_DESKTOP_TOKEN', 'fixture-capability-with-at-least-32-characters');
    expect(() => validateRuntimeSecrets()).not.toThrow();
    const next = vi.fn();
    requireDesktopToken({ get: () => process.env.SHIFTMINT_DESKTOP_TOKEN } as AuthenticatedRequest, {} as Response, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('accepts configured web mode and preserves its required secret validation', () => {
    vi.stubEnv('SHIFTMINT_RUNTIME', 'web');
    vi.stubEnv('JWT_SECRET', 'fixture-jwt-with-at-least-32-characters');
    vi.stubEnv('ENCRYPTION_KEY', 'ab'.repeat(32));
    vi.stubEnv('BOOTSTRAP_TOKEN', 'fixture-bootstrap-with-at-least-32-characters');
    vi.stubEnv('SHIFTMINT_DATA_DIR', path.resolve('.tmp-tests', 'runtime-storage'));
    expect(() => validateRuntimeSecrets()).not.toThrow();
    const next = vi.fn();
    requireDesktopToken({} as AuthenticatedRequest, {} as Response, next);
    expect(next).toHaveBeenCalledOnce();
    vi.stubEnv('BOOTSTRAP_TOKEN', 'short');
    expect(() => validateRuntimeSecrets()).toThrow('Hosted BOOTSTRAP_TOKEN');
  });
});
