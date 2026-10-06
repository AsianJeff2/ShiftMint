/**
 * Logger abstraction using Winston
 * Replaces all console.log/error/warn statements
 *
 * Benefits:
 * - Structured logging (JSON format)
 * - Log levels (debug, info, warn, error)
 * - File-based logging in production
 * - Silent in tests
 * - Searchable and parseable logs
 */

import winston from 'winston';
import { config } from './ConfigurationService';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'node:url';

export interface ILogger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}

/**
 * Production logger using Winston
 */
class WinstonLogger implements ILogger {
  private logger: winston.Logger;
  private readonly logDirectory: string;

  constructor() {
    this.logDirectory = this.resolveLogDirectory();
    this.ensureLogDirectory();
    this.logger = winston.createLogger({
      level: config.get('logLevel'),
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.errors({ stack: true }),
        winston.format.metadata(),
        winston.format.json()
      ),
      transports: this.getTransports(),
      exitOnError: false,
    });
  }

  private resolveLogDirectory(): string {
    const dataDirectory = process.env.SHIFTMINT_DATA_DIR;
    if (dataDirectory) {
      if (!path.isAbsolute(dataDirectory)) throw new Error('SHIFTMINT_DATA_DIR must be an absolute path');
      return path.join(dataDirectory, 'logs');
    }
    const databaseUrl = config.get('databaseUrl');
    const databasePath = databaseUrl.startsWith('file://') ? fileURLToPath(databaseUrl)
      : databaseUrl.startsWith('file:') ? databaseUrl.slice(5).split('?')[0] : '';
    return path.isAbsolute(databasePath) ? path.join(path.dirname(databasePath), 'logs') : path.join(process.cwd(), 'logs');
  }

  private ensureLogDirectory(): void {
    fs.mkdirSync(this.logDirectory, { recursive: true });
  }

  private getTransports(): winston.transport[] {
    const transports: winston.transport[] = [];

    // Don't log to files/console in test environment
    if (config.isTest()) {
      return transports;
    }

    // Production JSON reaches the hosting platform console; development stays readable.
    if (config.isDevelopment()) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, ...meta }) => {
              let metaStr = '';
              if (Object.keys(meta).length > 0) {
                metaStr = '\n' + JSON.stringify(meta, null, 2);
              }
              return `${timestamp} [${level}]: ${message}${metaStr}`;
            })
          ),
        })
      );
    } else {
      transports.push(new winston.transports.Console());
    }

    // File logging (both development and production)
    if (!config.isTest()) {
      transports.push(
        // Error log - only errors
        new winston.transports.File({
          filename: path.join(this.logDirectory, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        // Combined log - all levels
        new winston.transports.File({
          filename: path.join(this.logDirectory, 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        })
      );
    }

    return transports;
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }
}

/**
 * Test logger that captures logs in memory
 * Silent - no console output during tests
 */
export class TestLogger implements ILogger {
  public logs: Array<{
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    meta?: any;
    timestamp: Date;
  }> = [];

  debug(message: string, meta?: any): void {
    this.logs.push({
      level: 'debug',
      message,
      meta,
      timestamp: new Date(),
    });
  }

  info(message: string, meta?: any): void {
    this.logs.push({
      level: 'info',
      message,
      meta,
      timestamp: new Date(),
    });
  }

  warn(message: string, meta?: any): void {
    this.logs.push({
      level: 'warn',
      message,
      meta,
      timestamp: new Date(),
    });
  }

  error(message: string, meta?: any): void {
    this.logs.push({
      level: 'error',
      message,
      meta,
      timestamp: new Date(),
    });
  }

  /**
   * Clear all captured logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Get logs of a specific level
   */
  getLogs(level?: 'debug' | 'info' | 'warn' | 'error'): typeof this.logs {
    if (!level) return this.logs;
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Check if a message was logged
   */
  hasMessage(message: string, level?: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const logsToCheck = level ? this.getLogs(level) : this.logs;
    return logsToCheck.some(log => log.message.includes(message));
  }
}

/**
 * Singleton logger instance
 * Use TestLogger in tests, WinstonLogger otherwise
 */
export const logger: ILogger = config.isTest() ? new TestLogger() : new WinstonLogger();

/**
 * Create a test logger for unit tests
 */
export const createTestLogger = (): TestLogger => new TestLogger();
