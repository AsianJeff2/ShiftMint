/**
 * Role-Based Access Control (RBAC) System
 *
 * Defines permissions and roles for the application.
 * Implements fine-grained access control for different user types.
 */

/**
 * Available roles in the system
 */
export type UserRole = 'owner' | 'admin' | 'manager' | 'staff';

/**
 * Permission categories
 */
export enum Permission {
  // Employee permissions
  EMPLOYEES_VIEW = 'employees:view',
  EMPLOYEES_CREATE = 'employees:create',
  EMPLOYEES_UPDATE = 'employees:update',
  EMPLOYEES_DELETE = 'employees:delete',

  // Shift permissions
  SHIFTS_VIEW = 'shifts:view',
  SHIFTS_CREATE = 'shifts:create',
  SHIFTS_UPDATE = 'shifts:update',
  SHIFTS_DELETE = 'shifts:delete',

  // Tip permissions
  TIPS_VIEW = 'tips:view',
  TIPS_CREATE = 'tips:create',
  TIPS_UPDATE = 'tips:update',
  TIPS_DELETE = 'tips:delete',

  // Payroll permissions
  PAYROLL_VIEW = 'payroll:view',
  PAYROLL_CREATE = 'payroll:create',
  PAYROLL_UPDATE = 'payroll:update',
  PAYROLL_DELETE = 'payroll:delete',
  PAYROLL_PROCESS = 'payroll:process',

  // Business configuration permissions
  CONFIG_VIEW = 'config:view',
  CONFIG_UPDATE = 'config:update',

  // User management permissions
  USERS_VIEW = 'users:view',
  USERS_CREATE = 'users:create',
  USERS_UPDATE = 'users:update',
  USERS_DELETE = 'users:delete',

  // Reports permissions
  REPORTS_VIEW = 'reports:view',
  REPORTS_EXPORT = 'reports:export',

  // Audit log permissions
  AUDIT_VIEW = 'audit:view',

  // System administration
  SYSTEM_ADMIN = 'system:admin',
}

/**
 * Role permission mappings
 * Defines which permissions each role has
 */
const rolePermissions: Record<UserRole, Permission[]> = {
  /**
   * Owner - Full system access
   * The business owner has complete control over all aspects
   */
  owner: Object.values(Permission),

  /**
   * Admin - Administrative access
   * Can manage employees, shifts, tips, payroll, and view reports
   * Cannot modify system configuration or manage other admins
   */
  admin: [
    // Employee management
    Permission.EMPLOYEES_VIEW,
    Permission.EMPLOYEES_CREATE,
    Permission.EMPLOYEES_UPDATE,
    Permission.EMPLOYEES_DELETE,

    // Shift management
    Permission.SHIFTS_VIEW,
    Permission.SHIFTS_CREATE,
    Permission.SHIFTS_UPDATE,
    Permission.SHIFTS_DELETE,

    // Tip management
    Permission.TIPS_VIEW,
    Permission.TIPS_CREATE,
    Permission.TIPS_UPDATE,
    Permission.TIPS_DELETE,

    // Payroll management
    Permission.PAYROLL_VIEW,
    Permission.PAYROLL_CREATE,
    Permission.PAYROLL_UPDATE,
    Permission.PAYROLL_DELETE,
    Permission.PAYROLL_PROCESS,

    // Configuration (view only)
    Permission.CONFIG_VIEW,

    // Reports
    Permission.REPORTS_VIEW,
    Permission.REPORTS_EXPORT,

    // Audit logs
    Permission.AUDIT_VIEW,
  ],

  /**
   * Manager - Operational management
   * Can view and manage employees, shifts, tips
   * Can view payroll but not process it
   * Cannot delete major records
   */
  manager: [
    // Employee management (no delete)
    Permission.EMPLOYEES_VIEW,
    Permission.EMPLOYEES_CREATE,
    Permission.EMPLOYEES_UPDATE,

    // Shift management
    Permission.SHIFTS_VIEW,
    Permission.SHIFTS_CREATE,
    Permission.SHIFTS_UPDATE,
    Permission.SHIFTS_DELETE,

    // Tip management
    Permission.TIPS_VIEW,
    Permission.TIPS_CREATE,
    Permission.TIPS_UPDATE,

    // Payroll (view only)
    Permission.PAYROLL_VIEW,

    // Reports
    Permission.REPORTS_VIEW,
    Permission.REPORTS_EXPORT,
  ],

  /**
   * Staff - Basic view access
   * Can view tips and reports. No user-to-employee identity mapping exists.
   * Cannot create, update, or delete anything
   * Read-only access for reporting purposes
   */
  staff: [
    Permission.TIPS_VIEW,
    Permission.REPORTS_VIEW,
  ],
};

/**
 * Check if a role has a specific permission
 *
 * @param role - User role to check
 * @param permission - Permission to verify
 * @returns true if the role has the permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = rolePermissions[role];
  return permissions?.includes(permission) ?? false;
}

/**
 * Check if a role has ALL of the specified permissions
 *
 * @param role - User role to check
 * @param permissions - Array of permissions to verify
 * @returns true if the role has all permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Check if a role has ANY of the specified permissions
 *
 * @param role - User role to check
 * @param permissions - Array of permissions to verify
 * @returns true if the role has at least one permission
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 *
 * @param role - User role
 * @returns Array of permissions
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return rolePermissions[role] || [];
}

/**
 * Get role hierarchy level (higher number = more permissions)
 *
 * @param role - User role
 * @returns Numeric level of the role
 */
export function getRoleLevel(role: UserRole): number {
  const levels: Record<UserRole, number> = {
    staff: 1,
    manager: 2,
    admin: 3,
    owner: 4,
  };
  return levels[role] || 0;
}

/**
 * Check if one role is higher than another in the hierarchy
 *
 * @param role - Role to check
 * @param comparisonRole - Role to compare against
 * @returns true if role is higher than comparisonRole
 */
export function isRoleHigherThan(role: UserRole, comparisonRole: UserRole): boolean {
  return getRoleLevel(role) > getRoleLevel(comparisonRole);
}

/**
 * Validate if a role can be assigned by the current user
 * Users can only assign roles lower than their own
 *
 * @param currentUserRole - Role of the user assigning
 * @param targetRole - Role to be assigned
 * @returns true if assignment is allowed
 */
export function canAssignRole(currentUserRole: UserRole, targetRole: UserRole): boolean {
  return isRoleHigherThan(currentUserRole, targetRole);
}

/**
 * Permission error with details
 */
export class PermissionError extends Error {
  constructor(
    message: string,
    public permission: Permission,
    public userRole: UserRole
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

/**
 * Assert that a user has a specific permission
 * Throws PermissionError if not authorized
 *
 * @param role - User role
 * @param permission - Required permission
 * @throws PermissionError if permission not granted
 */
export function requirePermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new PermissionError(
      `Permission denied: ${permission}`,
      permission,
      role
    );
  }
}

/**
 * Resource-based permission check
 * Checks if user can perform action on a specific resource
 *
 * @param role - User role
 * @param resource - Resource type (employee, shift, etc.)
 * @param action - Action to perform (view, create, update, delete)
 * @returns true if action is allowed
 */
export function canAccessResource(
  role: UserRole,
  resource: 'employees' | 'shifts' | 'tips' | 'payroll' | 'config' | 'users' | 'reports' | 'audit',
  action: 'view' | 'create' | 'update' | 'delete' | 'process' | 'export'
): boolean {
  const permissionKey = `${resource}:${action}` as Permission;
  return hasPermission(role, permissionKey);
}
