import { describe, it, expect } from 'vitest';
import {
  calculatePayroll,
  calculateOvertimeHours,
  calculateWeeklyOvertime,
  calculateEffectiveRate,
  validatePayrollOutput,
  roundToCents,
} from './PayrollCalculator';

describe('PayrollCalculator', () => {
  describe('calculatePayroll', () => {
    it('calculates basic payroll without overtime or tips', () => {
      const result = calculatePayroll({
        regularHours: 40,
        overtimeHours: 0,
        hourlyWage: 15,
        overtimeRate: 1.5,
        tips: 0,
        taxRate: 0.22,
      });

      expect(result.regularPay).toBe(600); // 40 * 15
      expect(result.overtimePay).toBe(0);
      expect(result.grossPay).toBe(600);
      expect(result.taxes).toBe(132); // 600 * 0.22
      expect(result.netPay).toBe(468); // 600 - 132
      expect(result.effectiveHourlyRate).toBe(15); // 600 / 40
    });

    it('calculates payroll with overtime', () => {
      const result = calculatePayroll({
        regularHours: 40,
        overtimeHours: 5,
        hourlyWage: 20,
        overtimeRate: 1.5,
        tips: 0,
        taxRate: 0.22,
      });

      expect(result.regularPay).toBe(800); // 40 * 20
      expect(result.overtimePay).toBe(150); // 5 * 20 * 1.5
      expect(result.grossPay).toBe(950); // 800 + 150
      expect(result.taxes).toBe(209); // 950 * 0.22
      expect(result.netPay).toBe(741); // 950 - 209
    });

    it('calculates payroll with tips', () => {
      const result = calculatePayroll({
        regularHours: 40,
        overtimeHours: 0,
        hourlyWage: 10,
        overtimeRate: 1.5,
        tips: 400,
        taxRate: 0.22,
      });

      expect(result.regularPay).toBe(400); // 40 * 10
      expect(result.grossPay).toBe(400);
      expect(result.taxes).toBe(88); // 400 * 0.22
      expect(result.netPay).toBe(712); // 400 - 88 + 400
      expect(result.effectiveHourlyRate).toBe(20); // (400 wages + 400 tips) / 40 hours
    });

    it('calculates effective hourly rate including tips', () => {
      const result = calculatePayroll({
        regularHours: 8,
        overtimeHours: 2,
        hourlyWage: 12,
        overtimeRate: 1.5,
        tips: 150,
        taxRate: 0.20,
      });

      // Regular: 8 * 12 = 96
      // Overtime: 2 * 12 * 1.5 = 36
      // Gross: 132
      // Tips: 150
      // Total earnings: 282
      // Hours: 10
      // Effective rate: 282 / 10 = 28.20
      expect(result.effectiveHourlyRate).toBe(28.2);
    });

    it('rounds monetary values to cents', () => {
      const result = calculatePayroll({
        regularHours: 10.5,
        overtimeHours: 0,
        hourlyWage: 15.33,
        overtimeRate: 1.5,
        tips: 0,
        taxRate: 0.22,
      });

      // 10.5 * 15.33 = 160.965 -> rounds to 160.97
      expect(result.regularPay).toBe(160.97);
      expect(result.grossPay).toBe(160.97);
      expect(result.taxes).toBe(35.41); // 160.97 * 0.22 = 35.4134 -> 35.41
    });

    it('handles zero hours worked', () => {
      const result = calculatePayroll({
        regularHours: 0,
        overtimeHours: 0,
        hourlyWage: 15,
        overtimeRate: 1.5,
        tips: 100,
        taxRate: 0.22,
      });

      expect(result.regularPay).toBe(0);
      expect(result.overtimePay).toBe(0);
      expect(result.grossPay).toBe(0);
      expect(result.taxes).toBe(0);
      expect(result.netPay).toBe(100); // Only tips
      expect(result.effectiveHourlyRate).toBe(0); // No hours = no rate
    });

    it('handles double-time overtime rate', () => {
      const result = calculatePayroll({
        regularHours: 40,
        overtimeHours: 8,
        hourlyWage: 25,
        overtimeRate: 2.0, // Double time
        tips: 0,
        taxRate: 0.25,
      });

      expect(result.regularPay).toBe(1000); // 40 * 25
      expect(result.overtimePay).toBe(400); // 8 * 25 * 2.0
      expect(result.grossPay).toBe(1400);
    });

    describe('validation', () => {
      it('throws on negative regular hours', () => {
        expect(() =>
          calculatePayroll({
            regularHours: -5,
            overtimeHours: 0,
            hourlyWage: 15,
            overtimeRate: 1.5,
            tips: 0,
            taxRate: 0.22,
          })
        ).toThrow('Hours cannot be negative');
      });

      it('throws on negative overtime hours', () => {
        expect(() =>
          calculatePayroll({
            regularHours: 40,
            overtimeHours: -2,
            hourlyWage: 15,
            overtimeRate: 1.5,
            tips: 0,
            taxRate: 0.22,
          })
        ).toThrow('Hours cannot be negative');
      });

      it('throws on negative wage', () => {
        expect(() =>
          calculatePayroll({
            regularHours: 40,
            overtimeHours: 0,
            hourlyWage: -15,
            overtimeRate: 1.5,
            tips: 0,
            taxRate: 0.22,
          })
        ).toThrow('Hourly wage cannot be negative');
      });

      it('throws on overtime rate less than 1', () => {
        expect(() =>
          calculatePayroll({
            regularHours: 40,
            overtimeHours: 5,
            hourlyWage: 15,
            overtimeRate: 0.5,
            tips: 0,
            taxRate: 0.22,
          })
        ).toThrow('Overtime rate must be at least 1.0');
      });

      it('throws on tax rate out of range', () => {
        expect(() =>
          calculatePayroll({
            regularHours: 40,
            overtimeHours: 0,
            hourlyWage: 15,
            overtimeRate: 1.5,
            tips: 0,
            taxRate: 1.5, // 150% tax rate is invalid
          })
        ).toThrow('Tax rate must be between 0 and 1');
      });

      it('throws on negative tips', () => {
        expect(() =>
          calculatePayroll({
            regularHours: 40,
            overtimeHours: 0,
            hourlyWage: 15,
            overtimeRate: 1.5,
            tips: -50,
            taxRate: 0.22,
          })
        ).toThrow('Tips cannot be negative');
      });
    });
  });

  describe('calculateOvertimeHours', () => {
    it('returns all regular hours when under threshold', () => {
      const result = calculateOvertimeHours(7, 8);

      expect(result.regular).toBe(7);
      expect(result.overtime).toBe(0);
    });

    it('returns all regular hours when exactly at threshold', () => {
      const result = calculateOvertimeHours(8, 8);

      expect(result.regular).toBe(8);
      expect(result.overtime).toBe(0);
    });

    it('splits hours at threshold', () => {
      const result = calculateOvertimeHours(10, 8);

      expect(result.regular).toBe(8);
      expect(result.overtime).toBe(2);
    });

    it('uses default 8-hour threshold', () => {
      const result = calculateOvertimeHours(9);

      expect(result.regular).toBe(8);
      expect(result.overtime).toBe(1);
    });

    it('handles fractional hours', () => {
      const result = calculateOvertimeHours(10.5, 8);

      expect(result.regular).toBe(8);
      expect(result.overtime).toBe(2.5);
    });

    it('works with weekly threshold (40 hours)', () => {
      const result = calculateOvertimeHours(45, 40);

      expect(result.regular).toBe(40);
      expect(result.overtime).toBe(5);
    });

    it('throws on negative hours', () => {
      expect(() => calculateOvertimeHours(-5, 8)).toThrow('Hours worked cannot be negative');
    });

    it('throws on non-positive threshold', () => {
      expect(() => calculateOvertimeHours(10, 0)).toThrow('Overtime threshold must be positive');
      expect(() => calculateOvertimeHours(10, -1)).toThrow('Overtime threshold must be positive');
    });
  });

  describe('calculateWeeklyOvertime', () => {
    it('calculates overtime for a standard 5-day, 8-hour week', () => {
      const dailyHours = [8, 8, 8, 8, 8]; // 40 hours total

      const result = calculateWeeklyOvertime(dailyHours);

      expect(result.regularHours).toBe(40);
      expect(result.overtimeHours).toBe(0);
    });

    it('calculates daily overtime when exceeding 8 hours/day', () => {
      const dailyHours = [10, 9, 8, 8, 7]; // Some days over 8 hours (42 total)

      const result = calculateWeeklyOvertime(dailyHours);

      // Day 1: 8 regular + 2 OT
      // Day 2: 8 regular + 1 OT
      // Day 3-5: all regular (8+8+7)
      // Total after daily calc: 39 regular + 3 OT = 42 hours
      // Weekly rule: 42 total hours with 40-hour weekly cap
      // The function enforces: regular hours capped at 40, OT = total - 40
      // Final: 40 regular + 2 OT (not 3, because weekly rule overrides daily)
      expect(result.regularHours).toBe(40);
      expect(result.overtimeHours).toBe(2);
      expect(result.dailyBreakdown).toHaveLength(5);
    });

    it('calculates weekly overtime when exceeding 40 hours', () => {
      const dailyHours = [8, 8, 8, 8, 8, 8, 8]; // 56 hours total (7 days)

      const result = calculateWeeklyOvertime(dailyHours);

      // All days are 8 hours (no daily OT)
      // But 56 > 40, so 16 hours become OT
      expect(result.regularHours).toBe(40);
      expect(result.overtimeHours).toBe(16);
    });

    it('combines daily and weekly overtime correctly', () => {
      const dailyHours = [10, 10, 10, 10, 10]; // 50 hours total, each day over 8

      const result = calculateWeeklyOvertime(dailyHours);

      // Each day: 8 regular + 2 OT = 10 total OT from daily
      // Weekly: 50 > 40, so 10 more hours should be OT
      // Total OT: 10 + 10 = 20 hours (which is more than the daily calculation)
      expect(result.regularHours).toBe(40);
      expect(result.overtimeHours).toBe(10); // Adjusted for weekly
    });

    it('handles empty week', () => {
      const dailyHours: number[] = [];

      const result = calculateWeeklyOvertime(dailyHours);

      expect(result.regularHours).toBe(0);
      expect(result.overtimeHours).toBe(0);
      expect(result.dailyBreakdown).toHaveLength(0);
    });

    it('supports custom daily threshold', () => {
      const dailyHours = [10, 10, 10];

      const result = calculateWeeklyOvertime(dailyHours, 10); // 10-hour daily threshold

      // No daily OT with 10-hour threshold
      expect(result.regularHours).toBe(30);
      expect(result.overtimeHours).toBe(0);
    });

    it('supports custom weekly threshold', () => {
      const dailyHours = [8, 8, 8, 8, 8, 8]; // 48 hours

      const result = calculateWeeklyOvertime(dailyHours, 8, 45); // 45-hour weekly threshold

      expect(result.regularHours).toBe(45);
      expect(result.overtimeHours).toBe(3); // 48 - 45
    });
  });

  describe('roundToCents', () => {
    it('rounds to 2 decimal places', () => {
      expect(roundToCents(10.123)).toBe(10.12);
      expect(roundToCents(10.125)).toBe(10.13);
      expect(roundToCents(10.127)).toBe(10.13);
    });

    it('handles whole numbers', () => {
      expect(roundToCents(10)).toBe(10);
      expect(roundToCents(100.00)).toBe(100);
    });

    it('handles negative values', () => {
      // Note: JavaScript's Math.round() uses round-half-away-from-zero
      // -10.125 * 100 = -1012.5, Math.round(-1012.5) = -1012, -1012/100 = -10.12
      expect(roundToCents(-10.125)).toBe(-10.12);
      expect(roundToCents(-10.123)).toBe(-10.12);
      expect(roundToCents(-10.126)).toBe(-10.13);
    });
  });

  describe('calculateEffectiveRate', () => {
    it('calculates rate including wages and tips', () => {
      const rate = calculateEffectiveRate(400, 200, 40);

      // (400 + 200) / 40 = 15
      expect(rate).toBe(15);
    });

    it('returns 0 for zero hours', () => {
      const rate = calculateEffectiveRate(400, 200, 0);

      expect(rate).toBe(0);
    });

    it('handles negative hours gracefully', () => {
      const rate = calculateEffectiveRate(400, 200, -10);

      expect(rate).toBe(0);
    });
  });

  describe('validatePayrollOutput', () => {
    it('validates correct payroll calculation', () => {
      const input = {
        regularHours: 40,
        overtimeHours: 5,
        hourlyWage: 20,
        overtimeRate: 1.5,
        tips: 100,
        taxRate: 0.22,
      };

      const output = calculatePayroll(input);
      const isValid = validatePayrollOutput(output, input);

      expect(isValid).toBe(true);
    });

    it('detects invalid gross pay', () => {
      const input = {
        regularHours: 40,
        overtimeHours: 0,
        hourlyWage: 15,
        overtimeRate: 1.5,
        tips: 0,
        taxRate: 0.22,
      };

      const output = calculatePayroll(input);
      output.grossPay = 999; // Wrong value

      const isValid = validatePayrollOutput(output, input);

      expect(isValid).toBe(false);
    });

    it('allows small rounding differences', () => {
      const input = {
        regularHours: 40,
        overtimeHours: 0,
        hourlyWage: 15,
        overtimeRate: 1.5,
        tips: 0,
        taxRate: 0.22,
      };

      const output = calculatePayroll(input);
      output.grossPay += 0.01; // 1 cent difference

      const isValid = validatePayrollOutput(output, input);

      expect(isValid).toBe(true); // Within tolerance
    });
  });

  describe('Payroll invariants', () => {
    it('netPay = grossPay - taxes + tips always holds', () => {
      const inputs = [
        { regularHours: 40, overtimeHours: 0, hourlyWage: 15, overtimeRate: 1.5, tips: 0, taxRate: 0.22 },
        { regularHours: 35, overtimeHours: 10, hourlyWage: 20, overtimeRate: 1.5, tips: 200, taxRate: 0.25 },
        { regularHours: 0, overtimeHours: 0, hourlyWage: 10, overtimeRate: 1.5, tips: 500, taxRate: 0.15 },
      ];

      inputs.forEach(input => {
        const output = calculatePayroll(input);
        const expectedNet = output.grossPay - output.taxes + input.tips;

        expect(Math.abs(output.netPay - expectedNet)).toBeLessThan(0.02);
      });
    });

    it('grossPay >= regularPay always holds', () => {
      const output = calculatePayroll({
        regularHours: 40,
        overtimeHours: 5,
        hourlyWage: 15,
        overtimeRate: 1.5,
        tips: 0,
        taxRate: 0.22,
      });

      expect(output.grossPay).toBeGreaterThanOrEqual(output.regularPay);
    });
  });
});
