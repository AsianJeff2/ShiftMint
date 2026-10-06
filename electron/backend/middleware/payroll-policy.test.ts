import { describe, expect, it } from 'vitest';
import { businessDateRange, calculateShiftPay, calculateShiftPayDetails, PayPolicy, PayrollSourceError } from './payroll-policy';
const policy: PayPolicy = { timeZone: 'America/Los_Angeles', weekStartDay: 1, weeklyOvertimeHours: 40, dailyOvertimeHours: null, estimatedTaxRate: 0.22 };
const shift = (start: string, end: string, hourlyRate = 20) => ({ startTime: new Date(start), endTime: new Date(end), status: 'completed', hourlyRate });
describe('business payroll calculations', () => {
  it('keeps gross wages equal to rounded regular and overtime wages with fractional clock seconds', () => {
    const rows = [shift('2026-10-05T16:00:00.000Z', '2026-10-06T01:00:01.800Z', 20)];
    const calculation = calculateShiftPayDetails(rows, 20, { ...policy, dailyOvertimeHours: 8.0003 });
    expect(calculation.totals).toMatchObject({ regularPay: 160.01, overtimePay: 30.01, grossPay: 190.02 });
    expect(calculation.details.reduce((sum, row) => Math.round(sum + row.grossPay * 100), 0)).toBe(Math.round(calculation.totals.grossPay * 100));
  });
  it('preserves per-shift rounded cent allocations and identifies invalid stored rates', () => {
    const rows = [shift('2026-10-05T16:00Z', '2026-10-05T16:01Z', 10), shift('2026-10-05T17:00Z', '2026-10-05T17:01Z', 11)];
    const calculation = calculateShiftPayDetails(rows, 20, policy);
    expect(calculation.details.reduce((sum, row) => sum + row.grossPay, 0)).toBe(calculation.totals.grossPay);
    try { calculateShiftPay([{ ...rows[0], id: 'bad-rate', hourlyRate: -1 }], 20, policy); throw new Error('Expected source rejection'); } catch (error) { expect(error).toBeInstanceOf(PayrollSourceError); expect((error as PayrollSourceError).shiftIds).toEqual(['bad-rate']); }
  });
  it('weights each shift wage by its actual hours', () => {
    const result = calculateShiftPay([shift('2026-10-05T16:00Z', '2026-10-05T17:00Z', 10), shift('2026-10-06T16:00Z', '2026-10-06T23:00Z', 20)], 20, policy);
    expect(result.grossPay).toBe(150);
  });
  it('accumulates daily overtime across split shifts only when configured', () => {
    const shifts = [shift('2026-10-05T16:00Z', '2026-10-05T22:00Z'), shift('2026-10-05T23:00Z', '2026-10-06T05:00Z')];
    expect(calculateShiftPay(shifts, 20, policy).regularHours).toBe(12);
    expect(calculateShiftPay(shifts, 20, { ...policy, dailyOvertimeHours: 8 })).toMatchObject({ regularHours: 8, overtimeHours: 4, grossPay: 280 });
  });
  it('applies the weekly threshold separately for each workweek', () => {
    const shifts = Array.from({ length: 6 }, (_, day) => shift(`2026-10-${String(5 + day).padStart(2, '0')}T16:00Z`, `2026-10-${String(6 + day).padStart(2, '0')}T00:00Z`));
    const result = calculateShiftPay(shifts, 20, policy);
    expect(result).toMatchObject({ regularHours: 40, overtimeHours: 8, grossPay: 1040 });
    expect(calculateShiftPay([...shifts, shift('2026-10-12T16:00Z', '2026-10-13T00:00Z')], 20, policy).regularHours).toBe(48);
  });
  it('uses venue midnight and includes the final business day', () => {
    const range = businessDateRange(new Date('2026-10-05T00:00Z'), new Date('2026-10-05T23:59:59.999Z'), policy.timeZone);
    expect(range.start.toISOString()).toBe('2026-10-05T07:00:00.000Z');
    expect(range.endExclusive.toISOString()).toBe('2026-10-06T07:00:00.000Z');
  });
  it('rejects reverse timestamps rather than producing negative pay', () => {
    expect(() => calculateShiftPay([shift('2026-10-05T20:00Z', '2026-10-05T16:00Z')], 20, policy)).toThrow('invalid');
  });
  it('counts earlier workweek hours without paying them again when a period starts midweek', () => {
    const shifts = Array.from({ length: 6 }, (_, day) => shift(`2026-10-${String(5 + day).padStart(2, '0')}T16:00Z`, `2026-10-${String(6 + day).padStart(2, '0')}T00:00Z`));
    const range = businessDateRange(new Date('2026-10-10'), new Date('2026-10-10'), policy.timeZone);
    expect(calculateShiftPay(shifts, 20, policy, range)).toMatchObject({ regularHours: 0, overtimeHours: 8, grossPay: 240 });
  });
  it('rejects overlapping work shifts instead of double-paying the same hours', () => {
    expect(() => calculateShiftPay([shift('2026-10-05T16:00Z', '2026-10-05T20:00Z'), shift('2026-10-05T19:00Z', '2026-10-05T21:00Z')], 20, policy)).toThrow('overlap');
  });
});
