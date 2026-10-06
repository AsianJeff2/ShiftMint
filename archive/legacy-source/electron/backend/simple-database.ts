import { logger } from '../../lib/infrastructure/Logger';
/**
 * Simplified Database Initialization
 * Uses direct Prisma operations instead of raw SQL
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

export async function initializeDatabaseSimple(prisma: PrismaClient): Promise<void> {
  logger.info('🔧 Simple database initialization...');
  
  try {
    // First, ensure we can connect
    await prisma.$connect();
    logger.info('✅ Database connection established');
    
    // Use Prisma's built-in migration system
    logger.info('📦 Applying database schema...');
    
    // This will create all tables based on the Prisma schema
    const { execSync } = require('child_process');
    const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
    
    if (fs.existsSync(schemaPath)) {
      // Use Prisma's push command to create tables
      try {
        execSync('npx prisma db push --force-reset', { 
          cwd: path.join(__dirname, '../..'),
          stdio: 'inherit'
        });
        logger.info('✅ Database schema applied successfully');
      } catch (pushError) {
        logger.info('⚠️  Prisma push failed, trying manual approach...');
        await createTablesManually(prisma);
      }
    } else {
      logger.info('⚠️  Schema file not found, creating tables manually...');
      await createTablesManually(prisma);
    }
    
    // Initialize default settings
    await initializeAppSettings(prisma);
    
    logger.info('✅ Database initialization completed successfully');
    
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    throw error;
  }
}

async function createTablesManually(prisma: PrismaClient): Promise<void> {
  logger.info('🔧 Creating tables manually...');
  
  // Create tables one by one using Prisma's $executeRaw
  const tables = [
    `CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      phone TEXT,
      website TEXT,
      ein TEXT,
      address TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      role TEXT DEFAULT 'owner',
      passwordHash TEXT NOT NULL,
      lastLoginAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      businessId TEXT NOT NULL,
      FOREIGN KEY (businessId) REFERENCES businesses(id)
    )`
  ];
  
  for (const sql of tables) {
    try {
      await prisma.$executeRawUnsafe(sql);
      logger.info('   ✅ Table created');
    } catch (error) {
      logger.info(`   ⚠️  Table creation warning: ${error.message}`);
    }
  }
}

async function initializeAppSettings(prisma: PrismaClient): Promise<void> {
  logger.info('🔧 Initializing app settings...');
  
  const defaultSettings = [
    { key: 'app_version', value: '2.0.0' },
    { key: 'install_date', value: new Date().toISOString() },
    { key: 'first_launch', value: 'true' }
  ];
  
  for (const setting of defaultSettings) {
    try {
      // Use raw SQL to avoid Prisma model issues
      await prisma.$executeRawUnsafe(
        `INSERT OR IGNORE INTO app_settings (id, key, value) VALUES (?, ?, ?)`,
        `setting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        setting.key,
        setting.value
      );
      logger.info(`   ✅ Setting initialized: ${setting.key}`);
    } catch (error) {
      logger.info(`   ⚠️  Setting warning: ${error.message}`);
    }
  }
}