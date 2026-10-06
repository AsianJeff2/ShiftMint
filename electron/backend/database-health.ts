import { logger } from '../../lib/infrastructure/Logger';
import { PrismaClient } from '@prisma/client';

export interface DatabaseHealthCheck {
  healthy: boolean;
  version: string;
  tablesCount: number;
  lastBackup?: string;
  issues: string[];
  recommendations: string[];
}

/**
 * Comprehensive database health check for production deployments
 */
export async function checkDatabaseHealth(prisma: PrismaClient): Promise<DatabaseHealthCheck> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let tablesCount = 0;
  let version = 'unknown';
  let lastBackup: string | undefined;

  try {
    // Check if basic tables are accessible
    const tableCounts = await Promise.all([
      prisma.appSetting.count(),
      prisma.business.count(),
      prisma.user.count(),
      prisma.employee.count(),
      prisma.shift.count(),
      prisma.tipEntry.count(),
      prisma.payrollPeriod.count()
    ]);
    
    tablesCount = tableCounts.length;
    
    // Get app version
    const versionSetting = await prisma.appSetting.findUnique({
      where: { key: 'app_version' }
    });
    if (versionSetting) {
      version = versionSetting.value;
    }
    
    // Check last backup
    const backupSetting = await prisma.appSetting.findUnique({
      where: { key: 'last_backup' }
    });
    if (backupSetting) {
      lastBackup = backupSetting.value;
      
      if (backupSetting.value === 'never') {
        recommendations.push('Consider creating your first database backup for data safety');
      } else {
        const lastBackupDate = new Date(backupSetting.value);
        const daysSinceBackup = (Date.now() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceBackup > 7) {
          recommendations.push(`Last backup was ${Math.floor(daysSinceBackup)} days ago - consider creating a new backup`);
        }
      }
    }
    
    // Check for orphaned records
    const orphanedTips = await prisma.tipEntry.count({
      where: {
        shiftId: {
          not: null
        },
        shift: null
      }
    });
    
    if (orphanedTips > 0) {
      issues.push(`Found ${orphanedTips} orphaned tip entries with invalid shift references`);
      recommendations.push('Run data cleanup to fix orphaned tip entries');
    }
    
    // Check for incomplete shifts
    const incompleteShifts = await prisma.shift.count({
      where: {
        endTime: null,
        status: 'active',
        startTime: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // More than 24 hours ago
        }
      }
    });
    
    if (incompleteShifts > 0) {
      issues.push(`Found ${incompleteShifts} shifts that have been active for more than 24 hours`);
      recommendations.push('Review and close incomplete shifts');
    }
    
    // Check database size
    const totalRecords = tableCounts.slice(1).reduce((total, count) => total + count, 0);
    if (totalRecords === 0) {
      recommendations.push('Database is empty - complete the initial setup process');
    }
    
    return {
      healthy: issues.length === 0,
      version,
      tablesCount,
      lastBackup,
      issues,
      recommendations
    };
    
  } catch (error) {
    issues.push(`Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      healthy: false,
      version: 'unknown',
      tablesCount: 0,
      issues,
      recommendations: ['Check database connection and schema integrity']
    };
  }
}

/**
 * Quick database connectivity test
 */
export async function testDatabaseConnection(prisma: PrismaClient): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Verify critical database functionality
 */
export async function verifyDatabaseIntegrity(prisma: PrismaClient): Promise<{success: boolean, errors: string[]}> {
  const errors: string[] = [];
  
  try {
    const violations = await prisma.$queryRawUnsafe<unknown[]>('PRAGMA foreign_key_check');
    if (violations.length) errors.push(`Database contains ${violations.length} invalid foreign-key references; preserve the workspace and repair a copy offline`);
    // Test basic CRUD operations
    const testSetting = await prisma.appSetting.upsert({
      where: { key: 'health_check_test' },
      update: { value: new Date().toISOString() },
      create: { key: 'health_check_test', value: new Date().toISOString() }
    });
    
    // Verify the setting was created/updated
    const retrieved = await prisma.appSetting.findUnique({
      where: { key: 'health_check_test' }
    });
    
    if (!retrieved || retrieved.id !== testSetting.id) {
      errors.push('Failed to verify database write operations');
    }
    
    // Clean up test data
    await prisma.appSetting.delete({
      where: { key: 'health_check_test' }
    });
    
  } catch (error) {
    errors.push(`Database integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}
