import type { Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { AuthenticatedRequest } from '../types/express';
import { Permission } from '../../../lib/security/rbac';
import { requirePermission } from './permissions';

export function authorizeApiRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const routePath = req.path.toLowerCase().replace(/\/+$/, '');
  const resource = routePath.split('/')[1];
  const action = ['GET', 'HEAD'].includes(req.method) ? 'view' : req.method === 'DELETE' ? 'delete' : req.method === 'POST' ? 'create' : 'update';
  let permission: Permission;
  if (resource === 'database' || resource === 'analytics') permission = Permission.SYSTEM_ADMIN;
  else if (resource === 'export') permission = Permission.REPORTS_EXPORT;
  else if (resource === 'tip-distribution' && req.method === 'POST' && routePath === '/tip-distribution/calculate') permission = Permission.PAYROLL_VIEW;
  else if (resource === 'business' || resource === 'tip-distribution') permission = req.method === 'GET' ? Permission.CONFIG_VIEW : Permission.CONFIG_UPDATE;
  else if (resource === 'payroll' && routePath.endsWith('/calculate')) permission = Permission.PAYROLL_PROCESS;
  else if (['employees', 'shifts', 'tips', 'payroll'].includes(resource)) permission = `${resource}:${action}` as Permission;
  else if (resource === 'pos' || resource === 'auth') { next(); return; }
  else { res.status(404).json({ message: 'Endpoint not found' }); return; }
  requirePermission(permission)(req, res, next);
}

export function requireDesktopToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (process.env.SHIFTMINT_RUNTIME === 'web') { next(); return; }
  if (process.env.SHIFTMINT_RUNTIME !== 'desktop') { res.status(503).json({ message: 'API runtime mode is not configured' }); return; }
  const expected = process.env.SHIFTMINT_DESKTOP_TOKEN;
  if (!expected || expected.length < 32) { res.status(503).json({ message: 'Desktop API authorization is not configured' }); return; }
  const left = Buffer.from(req.get('X-Desktop-Token') || '');
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) { res.status(403).json({ message: 'Desktop API authorization is required' }); return; }
  next();
}

export function requireBootstrapToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const expected = process.env.BOOTSTRAP_TOKEN;
  const supplied = req.get('X-Bootstrap-Token');
  if (!expected) { res.status(503).json({ message: 'Setup bootstrap authorization is not configured' }); return; }
  const left = Buffer.from(supplied || '');
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    res.status(403).json({ message: 'A valid bootstrap token is required' });
    return;
  }
  next();
}

export function backupPath(directory: string, name: unknown): string | null {
  if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name) || name.includes('..')) return null;
  // A basename allowlist excludes separators, drive names and encoded traversal.
  return path.resolve(directory, name);
}
