import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import { ConfigurationService } from './ConfigurationService';

describe('ConfigurationService', () => {
  const originalEnv = process.env;
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    Object.defineProperty(process, 'platform', originalPlatform);
    vi.restoreAllMocks();
  });

  describe('JWT Secret Validation', () => {
    it('throws error in production without JWT_SECRET', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      expect(() => new ConfigurationService()).toThrow(/JWT_SECRET.*must be set/i);
      expect(() => new ConfigurationService()).toThrow(/CRITICAL SECURITY ERROR/);
    });

    it('uses JWT_SECRET from environment when provided', () => {
      process.env.JWT_SECRET = 'my-secure-secret-key-123';
      process.env.NODE_ENV = 'production';

      const config = new ConfigurationService();

      expect(config.get('jwtSecret')).toBe('my-secure-secret-key-123');
    });

    it('generates development secret in development mode', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.JWT_SECRET;

      const config = new ConfigurationService();
      const secret = config.get('jwtSecret');

      expect(secret).toBeTruthy();
      expect(secret).toContain('dev-secret');
    });

    it('generates development secret in test mode', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.JWT_SECRET;

      const config = new ConfigurationService();
      const secret = config.get('jwtSecret');

      expect(secret).toBeTruthy();
      expect(secret).toContain('dev-secret');
    });
  });

  describe('Port Configuration', () => {
    it('uses PORT from environment when provided', () => {
      process.env.PORT = '4000';

      const config = new ConfigurationService();

      expect(config.get('port')).toBe(4000);
    });

    it('defaults to 3001 when PORT not set', () => {
      delete process.env.PORT;

      const config = new ConfigurationService();

      expect(config.get('port')).toBe(3001);
    });

    it('parses PORT as integer', () => {
      process.env.PORT = '8080';

      const config = new ConfigurationService();

      expect(config.get('port')).toBe(8080);
      expect(typeof config.get('port')).toBe('number');
    });
  });

  describe('Node Environment', () => {
    it('uses NODE_ENV from environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'test-secret-for-production'; // Required in production

      const config = new ConfigurationService();

      expect(config.get('nodeEnv')).toBe('production');
    });

    it('defaults to development when NODE_ENV not set', () => {
      delete process.env.NODE_ENV;

      const config = new ConfigurationService();

      expect(config.get('nodeEnv')).toBe('development');
    });

    it('provides helper methods for environment checks', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'test-secret-for-production'; // Required in production
      const prodConfig = new ConfigurationService();

      expect(prodConfig.isProduction()).toBe(true);
      expect(prodConfig.isDevelopment()).toBe(false);
      expect(prodConfig.isTest()).toBe(false);

      process.env.NODE_ENV = 'development';
      const devConfig = new ConfigurationService();

      expect(devConfig.isProduction()).toBe(false);
      expect(devConfig.isDevelopment()).toBe(true);
      expect(devConfig.isTest()).toBe(false);

      process.env.NODE_ENV = 'test';
      const testConfig = new ConfigurationService();

      expect(testConfig.isProduction()).toBe(false);
      expect(testConfig.isDevelopment()).toBe(false);
      expect(testConfig.isTest()).toBe(true);
    });
  });

  describe('Log Level Configuration', () => {
    it('uses LOG_LEVEL from environment when provided', () => {
      process.env.LOG_LEVEL = 'debug';

      const config = new ConfigurationService();

      expect(config.get('logLevel')).toBe('debug');
    });

    it('defaults to error in test environment', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.LOG_LEVEL;

      const config = new ConfigurationService();

      expect(config.get('logLevel')).toBe('error');
    });

    it('defaults to debug in development environment', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.LOG_LEVEL;

      const config = new ConfigurationService();

      expect(config.get('logLevel')).toBe('debug');
    });

    it('defaults to info in production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'test-secret';
      delete process.env.LOG_LEVEL;

      const config = new ConfigurationService();

      expect(config.get('logLevel')).toBe('info');
    });
  });

  describe('Database URL Configuration', () => {
    it('uses DATABASE_URL from environment when provided', () => {
      process.env.DATABASE_URL = 'file:/custom/path/database.db';

      const config = new ConfigurationService();

      expect(config.get('databaseUrl')).toBe('file:/custom/path/database.db');
    });

    it.each([
      ['win32', ['AppData', 'Roaming', 'ShiftMint', 'shiftmint.db']],
      ['darwin', ['Library', 'Application Support', 'ShiftMint', 'shiftmint.db']],
      ['linux', ['.shiftmint', 'shiftmint.db']],
    ] as const)('uses the %s default directory without an explicit database URL', (platform, segments) => {
      delete process.env.DATABASE_URL;
      delete process.env.APPDATA;
      const fixtureHome = path.resolve('.tmp-tests', 'configuration-profile');
      vi.spyOn(require('os'), 'homedir').mockReturnValue(fixtureHome);
      Object.defineProperty(process, 'platform', { value: platform });

      const config = new ConfigurationService();

      expect(config.get('databaseUrl')).toBe(`file:${path.join(fixtureHome, ...segments)}`);
    });

    it('honors the Windows APPDATA directory rather than the profile fallback', () => {
      delete process.env.DATABASE_URL;
      const fixtureAppData = path.resolve('.tmp-tests', 'configuration-roaming');
      process.env.APPDATA = fixtureAppData;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      expect(new ConfigurationService().get('databaseUrl')).toBe(`file:${path.join(fixtureAppData, 'ShiftMint', 'shiftmint.db')}`);
    });
  });

  describe('getAll method', () => {
    it('returns all configuration values', () => {
      process.env.JWT_SECRET = 'test-secret';
      process.env.PORT = '3000';
      process.env.NODE_ENV = 'development';
      process.env.LOG_LEVEL = 'info';

      const config = new ConfigurationService();
      const allConfig = config.getAll();

      expect(allConfig).toHaveProperty('jwtSecret');
      expect(allConfig).toHaveProperty('port');
      expect(allConfig).toHaveProperty('nodeEnv');
      expect(allConfig).toHaveProperty('logLevel');
      expect(allConfig).toHaveProperty('databaseUrl');
    });

    it('returns a copy (not mutable reference)', () => {
      process.env.JWT_SECRET = 'test-secret';
      const config = new ConfigurationService();

      const config1 = config.getAll();
      const config2 = config.getAll();

      expect(config1).not.toBe(config2); // Different objects
      expect(config1).toEqual(config2); // But same values
    });
  });

  describe('Security invariants', () => {
    it('never returns production config without explicit JWT_SECRET', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      // Should throw, not return a default
      expect(() => new ConfigurationService()).toThrow();
    });

    it('development secret includes timestamp for uniqueness', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.JWT_SECRET;

      const config1 = new ConfigurationService();
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 2));
      const config2 = new ConfigurationService();

      // Secrets should be different due to timestamp
      const secret1 = config1.get('jwtSecret');
      const secret2 = config2.get('jwtSecret');

      expect(secret1).not.toBe(secret2);
    });
  });
});
