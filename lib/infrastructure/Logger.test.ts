import { describe, it, expect, beforeEach } from 'vitest';
import { TestLogger, createTestLogger } from './Logger';

describe('Logger', () => {
  describe('TestLogger', () => {
    let logger: TestLogger;

    beforeEach(() => {
      logger = createTestLogger();
    });

    it('captures debug logs', () => {
      logger.debug('Debug message');

      expect(logger.logs).toHaveLength(1);
      expect(logger.logs[0].level).toBe('debug');
      expect(logger.logs[0].message).toBe('Debug message');
    });

    it('captures info logs', () => {
      logger.info('Info message');

      expect(logger.logs).toHaveLength(1);
      expect(logger.logs[0].level).toBe('info');
      expect(logger.logs[0].message).toBe('Info message');
    });

    it('captures warn logs', () => {
      logger.warn('Warning message');

      expect(logger.logs).toHaveLength(1);
      expect(logger.logs[0].level).toBe('warn');
      expect(logger.logs[0].message).toBe('Warning message');
    });

    it('captures error logs', () => {
      logger.error('Error message');

      expect(logger.logs).toHaveLength(1);
      expect(logger.logs[0].level).toBe('error');
      expect(logger.logs[0].message).toBe('Error message');
    });

    it('captures metadata with logs', () => {
      const meta = { userId: 123, action: 'login' };
      logger.info('User logged in', meta);

      expect(logger.logs[0].meta).toEqual(meta);
    });

    it('captures multiple logs in order', () => {
      logger.debug('First');
      logger.info('Second');
      logger.warn('Third');
      logger.error('Fourth');

      expect(logger.logs).toHaveLength(4);
      expect(logger.logs[0].message).toBe('First');
      expect(logger.logs[1].message).toBe('Second');
      expect(logger.logs[2].message).toBe('Third');
      expect(logger.logs[3].message).toBe('Fourth');
    });

    it('includes timestamp with each log', () => {
      const before = new Date();
      logger.info('Test message');
      const after = new Date();

      const logTimestamp = logger.logs[0].timestamp;
      expect(logTimestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(logTimestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    describe('clear method', () => {
      it('removes all captured logs', () => {
        logger.info('Message 1');
        logger.info('Message 2');
        logger.info('Message 3');

        expect(logger.logs).toHaveLength(3);

        logger.clear();

        expect(logger.logs).toHaveLength(0);
      });
    });

    describe('getLogs method', () => {
      beforeEach(() => {
        logger.debug('Debug 1');
        logger.info('Info 1');
        logger.warn('Warn 1');
        logger.error('Error 1');
        logger.debug('Debug 2');
        logger.info('Info 2');
      });

      it('returns all logs when no level specified', () => {
        const allLogs = logger.getLogs();
        expect(allLogs).toHaveLength(6);
      });

      it('filters logs by debug level', () => {
        const debugLogs = logger.getLogs('debug');
        expect(debugLogs).toHaveLength(2);
        expect(debugLogs.every(log => log.level === 'debug')).toBe(true);
      });

      it('filters logs by info level', () => {
        const infoLogs = logger.getLogs('info');
        expect(infoLogs).toHaveLength(2);
        expect(infoLogs.every(log => log.level === 'info')).toBe(true);
      });

      it('filters logs by warn level', () => {
        const warnLogs = logger.getLogs('warn');
        expect(warnLogs).toHaveLength(1);
        expect(warnLogs[0].message).toBe('Warn 1');
      });

      it('filters logs by error level', () => {
        const errorLogs = logger.getLogs('error');
        expect(errorLogs).toHaveLength(1);
        expect(errorLogs[0].message).toBe('Error 1');
      });
    });

    describe('hasMessage method', () => {
      beforeEach(() => {
        logger.debug('User session started');
        logger.info('User logged in successfully');
        logger.warn('API rate limit approaching');
        logger.error('Database connection failed');
      });

      it('finds message across all levels', () => {
        expect(logger.hasMessage('User logged in')).toBe(true);
        expect(logger.hasMessage('Database connection')).toBe(true);
        expect(logger.hasMessage('nonexistent message')).toBe(false);
      });

      it('finds message by specific level', () => {
        expect(logger.hasMessage('User logged in', 'info')).toBe(true);
        expect(logger.hasMessage('Database connection', 'error')).toBe(true);
        expect(logger.hasMessage('User logged in', 'error')).toBe(false);
      });

      it('supports partial message matching', () => {
        expect(logger.hasMessage('rate limit')).toBe(true);
        expect(logger.hasMessage('session')).toBe(true);
        expect(logger.hasMessage('failed')).toBe(true);
      });
    });

    describe('Log structure invariants', () => {
      it('every log has required fields', () => {
        logger.info('Test message', { extra: 'data' });

        const log = logger.logs[0];
        expect(log).toHaveProperty('level');
        expect(log).toHaveProperty('message');
        expect(log).toHaveProperty('timestamp');
        expect(log.timestamp).toBeInstanceOf(Date);
      });

      it('metadata is optional', () => {
        logger.info('Message without metadata');

        expect(logger.logs[0].meta).toBeUndefined();
      });

      it('handles complex metadata objects', () => {
        const complexMeta = {
          user: { id: 123, name: 'Alice' },
          action: 'update',
          changes: ['field1', 'field2'],
          timestamp: new Date(),
        };

        logger.info('Complex log', complexMeta);

        expect(logger.logs[0].meta).toEqual(complexMeta);
      });
    });

    describe('Multiple logger instances', () => {
      it('are independent', () => {
        const logger1 = createTestLogger();
        const logger2 = createTestLogger();

        logger1.info('Logger 1 message');
        logger2.info('Logger 2 message');

        expect(logger1.logs).toHaveLength(1);
        expect(logger2.logs).toHaveLength(1);
        expect(logger1.logs[0].message).toBe('Logger 1 message');
        expect(logger2.logs[0].message).toBe('Logger 2 message');
      });
    });
  });
});
