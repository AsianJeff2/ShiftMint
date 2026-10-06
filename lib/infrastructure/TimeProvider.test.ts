import { describe, it, expect } from 'vitest';
import { SystemTimeProvider, FixedTimeProvider, createFixedTimeProvider } from './TimeProvider';

describe('TimeProvider', () => {
  describe('SystemTimeProvider', () => {
    it('returns current time', () => {
      const provider = new SystemTimeProvider();
      const before = Date.now();
      const result = provider.timestamp();
      const after = Date.now();

      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });

    it('returns Date object for now()', () => {
      const provider = new SystemTimeProvider();
      const result = provider.now();

      expect(result).toBeInstanceOf(Date);
    });

    it('returns ISO string for nowISO()', () => {
      const provider = new SystemTimeProvider();
      const result = provider.nowISO();

      // ISO string format: 2024-01-15T12:00:00.000Z
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('FixedTimeProvider', () => {
    it('returns fixed time consistently', () => {
      const fixedDate = new Date('2024-01-15T12:00:00Z');
      const provider = new FixedTimeProvider(fixedDate);

      expect(provider.now()).toEqual(fixedDate);
      expect(provider.now()).toEqual(fixedDate); // Second call returns same
    });

    it('returns correct ISO string', () => {
      const fixedDate = new Date('2024-01-15T12:00:00.000Z');
      const provider = new FixedTimeProvider(fixedDate);

      expect(provider.nowISO()).toBe('2024-01-15T12:00:00.000Z');
    });

    it('returns correct timestamp', () => {
      const fixedDate = new Date('2024-01-15T12:00:00.000Z');
      const provider = new FixedTimeProvider(fixedDate);

      expect(provider.timestamp()).toBe(fixedDate.getTime());
    });

    it('can update time with setTime()', () => {
      const initialDate = new Date('2024-01-01T00:00:00Z');
      const newDate = new Date('2024-12-31T23:59:59Z');
      const provider = new FixedTimeProvider(initialDate);

      expect(provider.now()).toEqual(initialDate);

      provider.setTime(newDate);

      expect(provider.now()).toEqual(newDate);
      expect(provider.nowISO()).toBe('2024-12-31T23:59:59.000Z');
    });

    it('can advance time with advanceBy()', () => {
      const provider = new FixedTimeProvider(new Date('2024-01-01T12:00:00Z'));

      // Advance by 1 hour (3600000 ms)
      provider.advanceBy(3600000);

      expect(provider.now()).toEqual(new Date('2024-01-01T13:00:00Z'));

      // Advance by 1 day (86400000 ms)
      provider.advanceBy(86400000);

      expect(provider.now()).toEqual(new Date('2024-01-02T13:00:00Z'));
    });
  });

  describe('createFixedTimeProvider factory', () => {
    it('creates a FixedTimeProvider instance', () => {
      const date = new Date('2024-06-15T10:30:00Z');
      const provider = createFixedTimeProvider(date);

      expect(provider).toBeInstanceOf(FixedTimeProvider);
      expect(provider.now()).toEqual(date);
    });
  });

  describe('Time invariants', () => {
    it('timestamp and now() are consistent', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const provider = new FixedTimeProvider(date);

      expect(provider.now().getTime()).toBe(provider.timestamp());
    });

    it('nowISO() matches now().toISOString()', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const provider = new FixedTimeProvider(date);

      expect(provider.nowISO()).toBe(provider.now().toISOString());
    });
  });
});
