import { logger } from '../../../lib/infrastructure/Logger';
import { Router } from 'express';
import { managedRouter } from '../middleware/request-lifecycle';
import {
  createDatabaseBackup,
  restoreDatabaseFromBackup,
  listDatabaseBackups,
  deleteDatabaseBackup,
  getDatabasePath,
  getBackupsDirectory
} from '../database';
import * as path from 'path';
import * as fs from 'fs';
import { checkDatabaseHealth } from '../database-health';
import { protect } from './auth';
import { AuthenticatedRequest, IdParamRequest } from '../types/express';
import { backupPath as resolveBackupPath } from '../middleware/api-security';
import { isSafeBackupFilename } from '../../../lib/database/backup-name';

const router = managedRouter();

// Note: Using proper JWT auth middleware imported from './auth'

// @route   POST /api/database/backup
// @desc    Create a new database backup
// @access  Private
router.post('/backup', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const { customName } = req.body;
    if (customName !== undefined && (!isSafeBackupFilename(customName) || !resolveBackupPath(getBackupsDirectory(), customName))) return res.status(400).json({ message: 'Backup name must be a safe .db filename' });
    
    const backupPath = await createDatabaseBackup(customName);
    const backupStats = fs.statSync(backupPath);
    
    res.json({
      success: true,
      message: 'Database backup created successfully',
      backup: {
        name: path.basename(backupPath),
        path: backupPath,
        size: backupStats.size,
        created: backupStats.birthtime
      }
    });
  } catch (error) {
    logger.error('Backup creation failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create backup'
    });
  }
});

// @route   GET /api/database/backups
// @desc    List all available backups
// @access  Private
router.get('/backups', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const backups = listDatabaseBackups();
    
    res.json({
      success: true,
      backups: backups.map(backup => ({
        ...backup,
        sizeFormatted: formatFileSize(backup.size),
        createdFormatted: backup.created.toLocaleString()
      }))
    });
  } catch (error) {
    logger.error('Failed to list backups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list backups'
    });
  }
});

// @route   POST /api/database/restore
// @desc    Restore database from backup
// @access  Private
router.post('/restore', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const { backupName } = req.body;
    
    if (!backupName) {
      return res.status(400).json({
        success: false,
        message: 'Backup name is required'
      });
    }
    
    // Construct full path to backup
    const backupsDir = getBackupsDirectory();
    const backupPath = resolveBackupPath(backupsDir, backupName);
    if (!backupPath) return res.status(400).json({ message: 'Invalid backup name' });
    
    await restoreDatabaseFromBackup(backupPath);
    
    res.json({
      success: true,
      message: 'Database restored successfully',
      restoredFrom: backupName
    });
  } catch (error) {
    logger.error('Database restore failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to restore database'
    });
  }
});

// @route   DELETE /api/database/backup/:name
// @desc    Delete a specific backup
// @access  Private
router.delete('/backup/:name', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const { name } = req.params;
    
    // Construct full path to backup
    const backupsDir = getBackupsDirectory();
    const backupPath = resolveBackupPath(backupsDir, name);
    if (!backupPath) return res.status(400).json({ message: 'Invalid backup name' });
    
    // Validate the backup exists and is in the backups directory
    if (!backupPath.startsWith(backupsDir)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid backup path'
      });
    }
    
    deleteDatabaseBackup(backupPath);
    
    res.json({
      success: true,
      message: 'Backup deleted successfully',
      deletedBackup: name
    });
  } catch (error) {
    logger.error('Failed to delete backup:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete backup'
    });
  }
});

// @route   POST /api/database/restore-from-file
// @desc    Restore database from uploaded file
// @access  Private
router.post('/restore-from-file', protect, async (req: AuthenticatedRequest, res) => {
  try {
    if (process.env.SHIFTMINT_RUNTIME === 'web') return res.status(403).json({ message: 'Restore from a local file is only available in the desktop application' });
    const { filePath } = req.body;
    
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath) || !/\.(db|sqlite|sqlite3)$/i.test(filePath)) {
      return res.status(400).json({
        success: false,
        message: 'File path is required'
      });
    }
    
    const selected = fs.realpathSync(filePath);
    if (!fs.statSync(selected).isFile()) return res.status(400).json({ message: 'Select a SQLite backup file' });
    const header = Buffer.alloc(16);
    const descriptor = fs.openSync(selected, 'r');
    try { fs.readSync(descriptor, header, 0, 16, 0); } finally { fs.closeSync(descriptor); }
    if (header.toString('utf8') !== 'SQLite format 3\u0000') return res.status(400).json({ message: 'Selected file is not a SQLite backup' });
    const importedPath = resolveBackupPath(getBackupsDirectory(), `imported-${Date.now()}.db`)!;
    fs.copyFileSync(selected, importedPath, fs.constants.COPYFILE_EXCL);
    await restoreDatabaseFromBackup(importedPath);
    
    res.json({
      success: true,
      message: 'Database restored successfully from uploaded file'
    });
  } catch (error) {
    logger.error('Database restore from file failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to restore from file'
    });
  }
});

// @route   GET /api/database/info
// @desc    Get database information
// @access  Private
router.get('/info', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const dbPath = getDatabasePath();
    const backupsDir = getBackupsDirectory();
    
    let dbSize = 0;
    let dbCreated = new Date();
    
    if (fs.existsSync(dbPath)) {
      const dbStats = fs.statSync(dbPath);
      dbSize = dbStats.size;
      dbCreated = dbStats.birthtime;
    }
    
    const backups = listDatabaseBackups();
    
    res.json({
      success: true,
      database: {
        path: dbPath,
        size: dbSize,
        sizeFormatted: formatFileSize(dbSize),
        created: dbCreated,
        createdFormatted: dbCreated.toLocaleString()
      },
      backups: {
        directory: backupsDir,
        count: backups.length,
        totalSize: backups.reduce((sum, backup) => sum + backup.size, 0),
        latest: backups[0] ? {
          name: backups[0].name,
          created: backups[0].created.toLocaleString()
        } : null
      }
    });
  } catch (error) {
    logger.error('Failed to get database info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get database information'
    });
  }
});

// Helper function to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// @route   GET /api/database/health
// @desc    Get comprehensive database health information
// @access  Private
router.get('/health', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const { getPrismaClient } = await import('../database');
    const prisma = getPrismaClient();
    
    const healthCheck = await checkDatabaseHealth(prisma);
    
    res.json({
      success: true,
      health: healthCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get database health:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get database health information',
      health: {
        healthy: false,
        version: 'unknown',
        tablesCount: 0,
        issues: ['Failed to connect to database'],
        recommendations: ['Check database connection']
      }
    });
  }
});

export default router;
