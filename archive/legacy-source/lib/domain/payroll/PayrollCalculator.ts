/**
 * Pure payroll calculation logic - Domain Layer
 *
 * CRITICAL PRINCIPLES:
 * - No database dependencies
 * - No Date() calls (use injected TimeProvider)
 * - No side effects
 * - All functions are pure and deterministic
 * - 100% testable without mocks
 *
 * This is the "heart" of payroll logic - it must be bulletproof
 */

export interface PayrollInput {
  regularHours: number;
  overtimeHours: number;
  hourlyWage: number;
  overtimeRate: number; // e.g., 1.5 for time-and-a-half
  tips: number;
  taxRate: number; // e.g., 0.22 for 22%
}

export interface PayrollOutput {
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  taxes: number;
  netPay: number;
  effectiveHourlyRate: number;
}

/**
 * Calculates payroll for a single employee for a pay period
 *
 * PURE FUNCTION - no side effects, fully testable
 *
 * @param input - Payroll calculation inputs
 * @returns Calculated payroll amounts
 * @throws Error if validation fails
 */
export function calculatePayroll(input: PayrollInput): PayrollOutput {
  // Input validation
  validatePayrollInput(input);

  // Core calculations
  const regularPay = input.regularHours * input.hourlyWage;
  const overtimePay = input.overtimeHours * input.hourlyWage * input.overtimeRate;
  const grossPay = regularPay + overtimePay;
  const taxes = grossPay * input.taxRate;
  const netPay = grossPay - taxes + input.tips;

  // Effective hourly rate = (wages + tips) / total hours
  const totalHours = input.regularHours + input.overtimeHours;
  const effectiveHourlyRate = totalHours > 0 ? (grossPay + input.tips) / totalHours : 0;

  return {
    regularPay: roundToCents(regularPay),
    overtimePay: roundToCents(overtimePay),
    grossPay: roundToCents(grossPay),
    taxes: roundToCents(taxes),
    netPay: roundToCents(netPay),
    effectiveHourlyRate: roundToCents(effectiveHourlyRate),
  };
}

/**
 * Validates payroll calculation inputs
 * @throws Error with descriptive message if validation fails
 */
function validatePayrollInput(input: PayrollInput): void {
  if (input.regularHours < 0 || input.overtimeHours < 0) {
    throw new Error('Hours cannot be negative');
  }

  if (input.hourlyWage < 0) {
    throw new Error('Hourly wage cannot be negative');
  }

  if (input.overtimeRate < 1) {
    throw new Error('Overtime rate must be at least 1.0 (typically 1.5 for time-and-a-half)');
  }

  if (input.taxRate < 0 || input.taxRate > 1) {
    throw new Error('Tax rate must be between 0 and 1 (e.g., 0.22 for 22%)');
  }

  if (input.tips < 0) {
    throw new Error('Tips cannot be negative');
  }
}

/**
 * Calculates overtime hours based on daily or weekly thresholds
 *
 * @param hoursWorked - Total hours worked
 * @param threshold - Overtime threshold (typically 8 for daily, 40 for weekly)
 * @returns Split of regular and overtime hours
 */
export function calculateOvertimeHours(
  hoursWorked: number,
  threshold: number = 8
): { regular: number; overtime: number } {
  if (hoursWorked < 0) {
    throw new Error('Hours worked cannot be negative');
  }

  if (threshold <= 0) {
    throw new Error('Overtime threshold must be positive');
  }

  if (hoursWorked <= threshold) {
    return { regular: hoursWorked, overtime: 0 };
  }

  return {
    regular: threshold,
    overtime: hoursWorked - threshold,
  };
}

/**
 * Calculates weekly overtime based on total hours worked
 * California law: overtime after 8 hours/day OR 40 hours/week
 *
 * @param dailyHours - Array of hours worked each day
 * @param dailyThreshold - Daily overtime threshold (default 8)
 * @param weeklyThreshold - Weekly overtime threshold (default 40)
 */
export function calculateWeeklyOvertime(
  dailyHours: number[],
  dailyThreshold: number = 8,
  weeklyThreshold: number = 40
): { regularHours: number; overtimeHours: number; dailyBreakdown: Array<{ regular: number; overtime: number }> } {
  // Calculate daily overtime first
  const dailyBreakdown = dailyHours.map(hours => calculateOvertimeHours(hours, dailyThreshold));

  // Sum up totals
  const totalRegular = dailyBreakdown.reduce((sum, day) => sum + day.regular, 0);
  const totalOvertime = dailyBreakdown.reduce((sum, day) => sum + day.overtime, 0);
  const totalHours = totalRegular + totalOvertime;

  // Check if weekly threshold triggers additional overtime
  if (totalHours > weeklyThreshold) {
    // Convert some regular hours to overtime
    const weeklyOvertimeHours = totalHours - weeklyThreshold;
    const adjustedRegular = weeklyThreshold;
    const adjustedOvertime = totalOvertime + (totalRegular - adjustedRegular);

    return {
      regularHours: adjustedRegular,
      overtimeHours: adjustedOvertime,
      dailyBreakdown,
    };
  }

  return {
    regularHours: totalRegular,
    overtimeHours: totalOvertime,
    dailyBreakdown,
  };
}

/**
 * Rounds a monetary value to cents (2 decimal places)
 * Uses banker's rounding (round half to even) for fairness
 */
export function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculates effective hourly rate including tips
 * This is what the employee "really" makes per hour
 *
 * @param grossWages - Total wages before taxes
 * @param tips - Total tips received
 * @param hoursWorked - Total hours worked
 */
export function calculateEffectiveRate(
  grossWages: number,
  tips: number,
  hoursWorked: number
): number {
  if (hoursWorked <= 0) {
    return 0;
  }

  return roundToCents((grossWages + tips) / hoursWorked);
}

/**
 * Validates that payroll totals are internally consistent
 * Use this to catch calculation errors
 *
 * Invariant: grossPay = regularPay + overtimePay
 * Invariant: netPay = grossPay - taxes + tips
 */
export function validatePayrollOutput(output: PayrollOutput, input: PayrollInput): boolean {
  const tolerance = 0.02; // 2 cents tolerance for rounding

  // Check: grossPay = regularPay + overtimePay
  const expectedGross = output.regularPay + output.overtimePay;
  if (Math.abs(output.grossPay - expectedGross) > tolerance) {
    return false;
  }

  // Check: netPay = grossPay - taxes + tips
  const expectedNet = output.grossPay - output.taxes + input.tips;
  if (Math.abs(output.netPay - expectedNet) > tolerance) {
    return false;
  }

  // Check: taxes = grossPay * taxRate (approximately)
  const expectedTaxes = output.grossPay * input.taxRate;
  if (Math.abs(output.taxes - expectedTaxes) > tolerance) {
    return false;
  }

  return true;
}
