/**
 * Audit Logging System
 *
 * Comprehensive audit logging for compliance and security monitoring.
 * Tracks all sensitive operations, data modifications, and access attempts.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../infrastructure/Logger';
import type { Request } from 'express';

/**
 * Audit event types
 */
export enum AuditAction {
  // Authentication events
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  TOKEN_REFRESHED = 'TOKEN_REFRESHED',
  SESSION_REVOKED = 'SESSION_REVOKED',

  // Data operations
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  READ = 'READ',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',

  // Permission changes
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  ROLE_CHANGED = 'ROLE_CHANGED',

  // Configuration changes
  CONFIG_UPDATED = 'CONFIG_UPDATED',
  SETTINGS_CHANGED = 'SETTINGS_CHANGED',

  // Sensitive data access
  SENSITIVE_DATA_ACCESSED = 'SENSITIVE_DATA_ACCESSED',
  FINANCIAL_DATA_ACCESSED = 'FINANCIAL_DATA_ACCESSED',

  // Security events
  ENCRYPTION_KEY_ROTATED = 'ENCRYPTION_KEY_ROTATED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

/**
 * Entity types for audit logs
 */
export enum AuditEntityType {
  USER = 'USER',
  EMPLOYEE = 'EMPLOYEE',
  SHIFT = 'SHIFT',
  TIP = 'TIP',
  PAYROLL = 'PAYROLL',
  BUSINESS = 'BUSINESS',
  CONFIG = 'CONFIG',
  SESSION = 'SESSION',
}

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  userId?: string;
  businessId: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
}

/**
 * Audit Logger class
 */
export class AuditLogger {
  constructor(private prisma: PrismaClient) {}

  /**
   * Log an audit event
   *
   * @param entry - Audit log entry
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          businessId: entry.businessId,
          oldValues: entry.oldValues ? JSON.stringify(entry.oldValues) : null,
          newValues: entry.newValues ? JSON.stringify(entry.newValues) : null,
          notes: entry.notes || null,
        },
      });

      // Also log to application logger for real-time monitoring
      logger.info('Audit log', {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        userId: entry.userId,
      });
    } catch (error) {
      // Audit logging should never break the application
      logger.error('Failed to write audit log', { error, entry });
    }
  }

  /**
   * Log authentication event
   */
  async logAuth(
    action: AuditAction,
    userId: string,
    businessId: string,
    req: Request,
    success: boolean = true
  ): Promise<void> {
    await this.log({
      action,
      entityType: AuditEntityType.USER,
      entityId: userId,
      businessId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      notes: success ? 'Successful' : 'Failed',
    });
  }

  /**
   * Log data modification
   */
  async logDataChange(
    action: AuditAction,
    entityType: AuditEntityType,
    entityId: string,
    businessId: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    userId?: string
  ): Promise<void> {
    // Sanitize sensitive fields before logging
    const sanitizedOld = oldValues ? this.sanitizeSensitiveData(oldValues) : undefined;
    const sanitizedNew = newValues ? this.sanitizeSensitiveData(newValues) : undefined;

    await this.log({
      action,
      entityType,
      entityId,
      businessId,
      userId,
      oldValues: sanitizedOld,
      newValues: sanitizedNew,
    });
  }

  /**
   * Log sensitive data access
   */
  async logSensitiveAccess(
    entityType: AuditEntityType,
    entityId: string,
    businessId: string,
    userId: string,
    req: Request,
    dataType: string
  ): Promise<void> {
    await this.log({
      action: AuditAction.SENSITIVE_DATA_ACCESSED,
      entityType,
      entityId,
      businessId,
      userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      notes: `Accessed ${dataType}`,
    });
  }

  /**
   * Log permission denial
   */
  async logPermissionDenied(
    action: string,
    entityType: AuditEntityType,
    entityId: string,
    businessId: string,
    userId: string,
    req: Request,
    reason?: string
  ): Promise<void> {
    await this.log({
      action: AuditAction.PERMISSION_DENIED,
      entityType,
      entityId,
      businessId,
      userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      notes: `Denied: ${action}. ${reason || ''}`,
    });
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(
    businessId: string,
    userId: string | undefined,
    req: Request,
    description: string
  ): Promise<void> {
    await this.log({
      action: AuditAction.SUSPICIOUS_ACTIVITY,
      entityType: AuditEntityType.USER,
      entityId: userId || 'unknown',
      businessId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      notes: description,
    });

    // Also log as warning for immediate attention
    logger.warn('Suspicious activity detected', {
      userId,
      ip: req.ip,
      description,
    });
  }

  /**
   * Log rate limit exceeded
   */
  async logRateLimitExceeded(
    req: Request,
    businessId?: string,
    userId?: string
  ): Promise<void> {
    await this.log({
      action: AuditAction.RATE_LIMIT_EXCEEDED,
      entityType: AuditEntityType.USER,
      entityId: userId || 'unknown',
      businessId: businessId || 'unknown',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      notes: `Path: ${req.path}`,
    });
  }

  /**
   * Query audit logs
   */
  async queryLogs(filters: {
    businessId?: string;
    userId?: string;
    entityType?: AuditEntityType;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const where: any = {};

    if (filters.businessId) where.businessId = filters.businessId;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.action) where.action = filters.action;

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    return await this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters.limit || 100,
    });
  }

  /**
   * Get audit statistics
   */
  async getStatistics(businessId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        businessId,
        timestamp: {
          gte: since,
        },
      },
    });

    // Group by action
    const actionCounts: Record<string, number> = {};
    const entityCounts: Record<string, number> = {};

    for (const log of logs) {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      entityCounts[log.entityType] = (entityCounts[log.entityType] || 0) + 1;
    }

    return {
      totalLogs: logs.length,
      actionCounts,
      entityCounts,
      period: `${days} days`,
    };
  }

  /**
   * Sanitize sensitive data before logging
   * Masks passwords, tokens, and other sensitive fields
   */
  private sanitizeSensitiveData(data: Record<string, any>): Record<string, any> {
    const sanitized = { ...data };
    const sensitiveFields = [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'bankAccountNumber',
      'bankRoutingNumber',
      'ssn',
      'socialSecurityNumber',
    ];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}

/**
 * Create an audit logger instance
 */
export function createAuditLogger(prisma: PrismaClient): AuditLogger {
  return new AuditLogger(prisma);
}
