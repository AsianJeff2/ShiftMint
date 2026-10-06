/**
 * Configuration service for environment variables
 * Prevents hardcoded secrets and provides type-safe configuration access
 *
 * CRITICAL SECURITY:
 * - No fallback for JWT_SECRET in production
 * - Validates required environment variables at startup
 * - Throws errors for missing critical config in production
 */

import { randomBytes } from 'node:crypto';

export interface AppConfig {
  jwtSecret: string;
  databaseUrl: string;
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class ConfigurationService {
  private config: AppConfig;

  constructor() {
    this.config = this.loadConfiguration();
  }

  private loadConfiguration(): AppConfig {
    const jwtSecret = process.env.JWT_SECRET;
    const nodeEnv = (process.env.NODE_ENV as AppConfig['nodeEnv']) || 'development';

    // CRITICAL SECURITY: No fallback for JWT_SECRET in production
    if (!jwtSecret && nodeEnv === 'production') {
      throw new Error(
        'CRITICAL SECURITY ERROR: JWT_SECRET environment variable must be set in production. ' +
          'Never use hardcoded secrets. Generate a secure random secret and set it in your environment.'
      );
    }

    return {
      jwtSecret: jwtSecret || this.generateDevelopmentSecret(),
      databaseUrl: process.env.DATABASE_URL || this.getDefaultDatabasePath(),
      port: parseInt(process.env.PORT || '3001', 10),
      nodeEnv,
      logLevel: (process.env.LOG_LEVEL as AppConfig['logLevel']) || this.getDefaultLogLevel(nodeEnv),
    };
  }

  private generateDevelopmentSecret(): string {
    // Only for development/testing - never production
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot generate development secret in production environment');
    }

    // Warn in development
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '⚠️  WARNING: Using auto-generated JWT secret for development. ' +
          'Set JWT_SECRET environment variable for consistent sessions.'
      );
    }

    return `dev-secret-${randomBytes(32).toString('hex')}`;
  }

  private getDefaultDatabasePath(): string {
    // Platform-specific default paths
    const os = require('os');
    const path = require('path');

    let appDataPath: string;

    switch (process.platform) {
      case 'win32':
        appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        break;
      case 'darwin':
        appDataPath = path.join(os.homedir(), 'Library', 'Application Support');
        break;
      default: // Linux and others
        return `file:${path.join(os.homedir(), '.shiftmint', 'shiftmint.db')}`;
    }

    return `file:${path.join(appDataPath, 'ShiftMint', 'shiftmint.db')}`;
  }

  private getDefaultLogLevel(nodeEnv: string): AppConfig['logLevel'] {
    switch (nodeEnv) {
      case 'test':
        return 'error'; // Quiet in tests
      case 'development':
        return 'debug'; // Verbose in development
      case 'production':
        return 'info'; // Balanced in production
      default:
        return 'info';
    }
  }

  /**
   * Get a specific configuration value
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  /**
   * Get all configuration (readonly)
   */
  getAll(): Readonly<AppConfig> {
    return { ...this.config };
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }

  /**
   * Check if running in test
   */
  isTest(): boolean {
    return this.config.nodeEnv === 'test';
  }
}

// Singleton instance for application-wide use
export const config = new ConfigurationService();
