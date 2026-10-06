import { describe, expect, it, vi } from 'vitest';
const requirePermission = vi.hoisted(() => vi.fn(() => vi.fn()));
vi.mock('./permissions', () => ({ requirePermission }));
import { authorizeApiRequest } from './api-security';
import { Permission } from '../../../lib/security/rbac';
import type { AuthenticatedRequest } from '../types/express';
import type { Response } from 'express';

describe('Express-compatible route authorization', () => {
  it.each(['/payroll/periods/a/calculate', '/payroll/periods/a/calculate/', '/PAYROLL/periods/a/CALCULATE'])('requires process permission for %s', path => {
    authorizeApiRequest({ path, method: 'POST' } as AuthenticatedRequest, {} as Response, vi.fn());
    expect(requirePermission).toHaveBeenLastCalledWith(Permission.PAYROLL_PROCESS);
  });
});
