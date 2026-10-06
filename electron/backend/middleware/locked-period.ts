import { getPrismaClient } from '../database';
import { businessDateRange, payPolicy, workweekStart } from './payroll-policy';

/** Source ledger records remain immutable while a containing payroll period is closed. */
export async function payrollDateLocked(businessId: string, dates: Date[]): Promise<boolean> {
  return payrollSourceLocked(businessId, dates, false);
}

/** Earlier workweek shifts determine overtime even when a period begins midweek. */
export async function payrollShiftLocked(businessId: string, start: Date, end?: Date | null): Promise<boolean> {
  return payrollSourceLocked(businessId, [start, end ?? new Date(8640000000000000)], true);
}

async function payrollSourceLocked(businessId: string, dates: Date[], includeWorkweekContext: boolean): Promise<boolean> {
  const prisma = getPrismaClient();
  const periods = await prisma.payrollPeriod.findMany({ where: { businessId, status: { in: ['closed', 'paid'] } } });
  if (periods.length === 0) return false;
  const configuration = await prisma.businessConfiguration.findUnique({ where: { businessId } });
  const policy = payPolicy(configuration);
  return periods.some(period => {
    const range = businessDateRange(period.startDate, period.endDate, policy.timeZone);
    if (includeWorkweekContext) range.start = workweekStart(range.start, policy);
    if (dates.length === 2) return dates[0] < range.endExclusive && dates[1] > range.start;
    return dates.some(date => date >= range.start && date < range.endExclusive);
  });
}
