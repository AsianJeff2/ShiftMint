/**
 * TimeProvider abstraction for deterministic testing
 *
 * This replaces all direct Date() calls in domain logic to make
 * time-dependent code testable and deterministic.
 *
 * Usage:
 * - Production: Use SystemTimeProvider (returns actual time)
 * - Testing: Use FixedTimeProvider (returns fixed time you control)
 */

export interface ITimeProvider {
  /** Returns the current time as a Date object */
  now(): Date;

  /** Returns the current time as an ISO string */
  nowISO(): string;

  /** Returns the current timestamp in milliseconds */
  timestamp(): number;
}

/**
 * Production time provider that returns actual system time
 */
export class SystemTimeProvider implements ITimeProvider {
  now(): Date {
    return new Date();
  }

  nowISO(): string {
    return new Date().toISOString();
  }

  timestamp(): number {
    return Date.now();
  }
}

/**
 * Test time provider that returns a fixed time
 * Allows tests to be deterministic and control time progression
 */
export class FixedTimeProvider implements ITimeProvider {
  constructor(private fixedDate: Date) {}

  now(): Date {
    return new Date(this.fixedDate);
  }

  nowISO(): string {
    return this.fixedDate.toISOString();
  }

  timestamp(): number {
    return this.fixedDate.getTime();
  }

  /**
   * Update the fixed time (useful for testing time progression)
   */
  setTime(date: Date): void {
    this.fixedDate = date;
  }

  /**
   * Advance time by specified milliseconds
   */
  advanceBy(milliseconds: number): void {
    this.fixedDate = new Date(this.fixedDate.getTime() + milliseconds);
  }
}

// Singleton for production use
export const timeProvider: ITimeProvider = new SystemTimeProvider();

// Test helper factory
export const createFixedTimeProvider = (date: Date): FixedTimeProvider => {
  return new FixedTimeProvider(date);
};
