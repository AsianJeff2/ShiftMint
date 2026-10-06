/**
 * Permission Middleware
 *
 * Express middleware for checking user permissions based on RBAC
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/express';
import { Permission, hasPermission, UserRole } from '../../../lib/security/rbac';
import { logger } from '../../../lib/infrastructure/Logger';

/**
 * Middleware factory to require specific permission
 *
 * Usage:
 *   router.get('/employees', protect, requirePermission(Permission.EMPLOYEES_VIEW), getEmployees)
 *
 * @param permission - Required permission
 * @returns Express middleware
 */
export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      logger.warn('Permission check failed: no authenticated user');
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const userRole = req.user.role as UserRole;

    if (!hasPermission(userRole, permission)) {
      logger.warn('Permission denied', {
        userId: req.user.userId,
        role: userRole,
        permission,
      });

      res.status(403).json({
        success: false,
        message: 'Permission denied',
        required: permission,
        userRole,
      });
      return;
    }

    logger.debug('Permission granted', {
      userId: req.user.userId,
      permission,
    });

    next();
  };
}

/**
 * Middleware factory to require ANY of the specified permissions
 *
 * Usage:
 *   router.get('/reports', protect, requireAnyPermission([Permission.REPORTS_VIEW, Permission.REPORTS_EXPORT]), getReports)
 *
 * @param permissions - Array of permissions (user must have at least one)
 * @returns Express middleware
 */
export function requireAnyPermission(permissions: Permission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const userRole = req.user.role as UserRole;
    const hasAnyPermission = permissions.some(permission => hasPermission(userRole, permission));

    if (!hasAnyPermission) {
      logger.warn('Permission denied (any)', {
        userId: req.user.userId,
        role: userRole,
        permissions,
      });

      res.status(403).json({
        success: false,
        message: 'Permission denied',
        required: permissions,
        userRole,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware factory to require ALL of the specified permissions
 *
 * Usage:
 *   router.post('/payroll/process', protect, requireAllPermissions([Permission.PAYROLL_VIEW, Permission.PAYROLL_PROCESS]), processPayroll)
 *
 * @param permissions - Array of permissions (user must have all)
 * @returns Express middleware
 */
export function requireAllPermissions(permissions: Permission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const userRole = req.user.role as UserRole;
    const hasAllPermissions = permissions.every(permission => hasPermission(userRole, permission));

    if (!hasAllPermissions) {
      logger.warn('Permission denied (all)', {
        userId: req.user.userId,
        role: userRole,
        permissions,
      });

      res.status(403).json({
        success: false,
        message: 'Permission denied',
        required: permissions,
        userRole,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require owner role only
 *
 * Usage:
 *   router.delete('/business', protect, requireOwner, deleteBusiness)
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware
 */
export function requireOwner(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  if (req.user.role !== 'owner') {
    logger.warn('Owner role required', {
      userId: req.user.userId,
      role: req.user.role,
    });

    res.status(403).json({
      success: false,
      message: 'Owner role required',
    });
    return;
  }

  next();
}

/**
 * Middleware to require admin or owner role
 *
 * Usage:
 *   router.post('/users', protect, requireAdmin, createUser)
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  const role = req.user.role;
  if (role !== 'owner' && role !== 'admin') {
    logger.warn('Admin role required', {
      userId: req.user.userId,
      role,
    });

    res.status(403).json({
      success: false,
      message: 'Admin or owner role required',
    });
    return;
  }

  next();
}
