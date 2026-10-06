import { describe, expect, it } from 'vitest';
import { toEmployeeDTO, toPayrollPeriodDTO, toShiftDTO, toTipEntryDTO } from '../../lib/transformers';
import { formatCalendarDate } from '../../lib/utils';

const timestamp = '2026-10-05T12:00:00.000Z';
const base = { id: 'id', businessId: 'business', createdAt: timestamp, updatedAt: timestamp };

describe('HTTP JSON entity conversion', () => {
  it('keeps payroll calendar dates stable for date-only and serialized UTC markers', () => {
    expect(formatCalendarDate('2026-10-05')).toBe('Oct 5, 2026');
    expect(formatCalendarDate('2026-10-05T00:00:00.000Z')).toBe('Oct 5, 2026');
    expect(formatCalendarDate(new Date('2026-10-05T00:00:00.000Z'))).toBe('Oct 5, 2026');
  });
  it('renders serialized employee, shift and tip dates without Date methods or bank disclosures', () => {
    const employee = toEmployeeDTO({ ...base, startDate: timestamp, terminationDate: null, bankAccountNumber: 'private', bankRoutingNumber: 'private' } as never);
    expect(employee.startDate).toBe('2026-10-05');
    expect(employee).not.toHaveProperty('bankAccountNumber');
    expect(employee).not.toHaveProperty('bankRoutingNumber');
    const shift = toShiftDTO({ ...base, startTime: timestamp, endTime: '2026-10-05T14:30:00.000Z' } as never);
    expect(shift).toMatchObject({ startTime: timestamp, hoursWorked: 2.5 });
    const tip = toTipEntryDTO({ ...base, timestamp, processedAt: timestamp } as never);
    expect(tip).toMatchObject({ timestamp, processedAt: timestamp, createdAt: timestamp });
  });
  it('retains server payroll entries so summaries and details show calculated amounts', () => {
    const entries = [{ id: 'entry', employeeId: 'employee', grossPay: 100, totalTaxes: 22, netPay: 78 }];
    expect(toPayrollPeriodDTO({ ...base, startDate: '2026-10-01', endDate: '2026-10-05', payrollEntries: entries } as never)).toMatchObject({ payrollEntries: entries, createdAt: timestamp });
  });
});
