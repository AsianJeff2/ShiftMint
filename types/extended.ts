/**
 * Extended types for entities with computed fields and relations
 * These extend Prisma types with fields that are calculated or loaded via relations
 */

import type { PayrollPeriod, PayrollEntry, Shift } from '@prisma/client';
import type { PayrollPeriodDTO } from '@/lib/transformers';

/**
 * PayrollPeriod with payrollEntries relation loaded
 */
export interface PayrollPeriodWithEntries extends PayrollPeriod {
  payrollEntries?: PayrollEntry[];
}

/**
 * PayrollPeriodDTO with payrollEntries relation loaded
 */
export interface PayrollPeriodDTOWithEntries extends PayrollPeriodDTO {
  payrollEntries?: PayrollEntry[];
}

/**
 * Shift with computed hoursWorked field
 */
export interface ShiftWithHours extends Shift {
  hoursWorked?: number;
}

/**
 * Calculate hours worked from a shift
 * @param shift - Shift with startTime and endTime
 * @returns Hours worked as decimal (e.g., 8.5)
 */
export function calculateHoursWorked(shift: Shift): number {
  if (!shift.endTime) {
    return 0;
  }

  const start = new Date(shift.startTime);
  const end = new Date(shift.endTime);
  const durationMs = end.getTime() - start.getTime();
  const hours = durationMs / (1000 * 60 * 60);

  return Math.round(hours * 100) / 100; // Round to 2 decimal places
}

/**
 * Add hoursWorked to a shift
 * @param shift - Shift from database
 * @returns Shift with hoursWorked calculated
 */
export function addHoursWorked(shift: Shift): ShiftWithHours {
  return {
    ...shift,
    hoursWorked: calculateHoursWorked(shift),
  };
}

/**
 * Add hoursWorked to multiple shifts
 * @param shifts - Array of shifts
 * @returns Array of shifts with hoursWorked
 */
export function addHoursWorkedToShifts(shifts: Shift[]): ShiftWithHours[] {
  return shifts.map(addHoursWorked);
}
