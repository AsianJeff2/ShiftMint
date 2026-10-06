export interface PayPolicy {
  timeZone: string;
  weekStartDay: number;
  weeklyOvertimeHours: number;
  dailyOvertimeHours: number | null;
  estimatedTaxRate: number;
}
export interface PayShift { id?: string; startTime: Date; endTime: Date | null; status: string; hourlyRate?: number; }
export class PayrollSourceError extends Error {
  constructor(message: string, public readonly shiftIds: string[]) { super(message); this.name = 'PayrollSourceError'; }
}

export function payPolicy(configuration?: { timeZone?: string; payPeriodStartDay?: number } | null): PayPolicy {
  const weekly = Number(process.env.PAYROLL_WEEKLY_OVERTIME_HOURS || 40);
  const daily = process.env.PAYROLL_DAILY_OVERTIME_HOURS ? Number(process.env.PAYROLL_DAILY_OVERTIME_HOURS) : null;
  const estimatedTaxRate = Number(process.env.PAYROLL_ESTIMATED_TAX_RATE || 0.22);
  const timeZone = configuration?.timeZone || 'America/New_York';
  const weekStartDay = configuration?.payPeriodStartDay ?? 1;
  if (!Number.isFinite(weekly) || weekly <= 0 || (daily !== null && (!Number.isFinite(daily) || daily <= 0)) || !Number.isFinite(estimatedTaxRate) || estimatedTaxRate < 0 || estimatedTaxRate > 1 || !Number.isInteger(weekStartDay) || weekStartDay < 0 || weekStartDay > 6) throw new Error('Invalid payroll policy');
  dateInZone(new Date(), timeZone); // Validate the configured IANA zone.
  return { timeZone, weekStartDay, weeklyOvertimeHours: weekly, dailyOvertimeHours: daily, estimatedTaxRate };
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
export const dateInZone = (date: Date, timeZone: string) => {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    if (dateFormatters.size >= 64) dateFormatters.delete(dateFormatters.keys().next().value!);
    dateFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
};

function nextMidnight(date: Date, timeZone: string): Date {
  const day = dateInZone(date, timeZone);
  let left = date.getTime();
  let right = left + 36 * 3600000;
  while (right - left > 1) {
    const middle = Math.floor((left + right) / 2);
    if (dateInZone(new Date(middle), timeZone) === day) left = middle;
    else right = middle;
  }
  return new Date(right);
}

export function businessDateRange(start: Date, end: Date, timeZone: string): { start: Date; endExclusive: Date } {
  // Date-only period DTOs are UTC calendar markers. Convert each marker to venue midnight.
  const midnight = (marker: Date) => {
    const target = marker.toISOString().slice(0, 10);
    let left = new Date(`${target}T00:00:00Z`).getTime() - 18 * 3600000;
    let right = left + 60 * 3600000;
    while (right - left > 1) {
      const middle = Math.floor((left + right) / 2);
      if (dateInZone(new Date(middle), timeZone) < target) left = middle;
      else right = middle;
    }
    return new Date(right);
  };
  const nextDate = new Date(`${end.toISOString().slice(0, 10)}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return { start: midnight(start), endExclusive: midnight(nextDate) };
}

export function workweekStart(date: Date, policy: PayPolicy): Date {
  const marker = new Date(`${dateInZone(date, policy.timeZone)}T00:00:00Z`);
  marker.setUTCDate(marker.getUTCDate() - (marker.getUTCDay() - policy.weekStartDay + 7) % 7);
  return businessDateRange(marker, marker, policy.timeZone).start;
}

export function calculateShiftPay(shifts: PayShift[], defaultRate: number, policy: PayPolicy, range?: { start: Date; endExclusive: Date }) {
  return calculateShiftPayDetails(shifts, defaultRate, policy, range).totals;
}

/** One sorted segment pass yields totals and per-shift amounts, without recalculating prefixes. */
export function calculateShiftPayDetails(shifts: PayShift[], defaultRate: number, policy: PayPolicy, range?: { start: Date; endExclusive: Date }) {
  const details = shifts.map(() => ({ regularHours: 0, overtimeHours: 0, regularPay: 0, overtimePay: 0, grossPay: 0 }));
  const sourceId = (index: number) => shifts[index].id ?? `row-${index + 1}`;
  const segments: { index: number; start: Date; day: string; week: string; hours: number; rate: number; payable: boolean }[] = [];
  for (const [index, shift] of shifts.entries()) {
    if (!Number.isFinite(shift.startTime.getTime()) || (shift.endTime && (!Number.isFinite(shift.endTime.getTime()) || shift.endTime < shift.startTime))) throw new PayrollSourceError('Shift timestamps are invalid; review source times', [sourceId(index)]);
    if (!shift.endTime || shift.status === 'break' || shift.status === 'pending_review') continue;
    let start = shift.startTime;
    const finish = new Date(Math.min(shift.endTime.getTime(), range?.endExclusive.getTime() ?? Infinity));
    while (start < finish) {
      const end = new Date(Math.min(nextMidnight(start, policy.timeZone).getTime(), finish.getTime(), range && start < range.start ? range.start.getTime() : Infinity));
      const day = dateInZone(start, policy.timeZone);
      const weekDate = new Date(`${day}T00:00:00Z`);
      weekDate.setUTCDate(weekDate.getUTCDate() - (weekDate.getUTCDay() - policy.weekStartDay + 7) % 7);
      if (shift.hourlyRate !== undefined && (!Number.isFinite(shift.hourlyRate) || shift.hourlyRate < 0)) throw new PayrollSourceError('Hourly rate is invalid; review source wages', [sourceId(index)]);
      const rate = shift.hourlyRate && shift.hourlyRate > 0 ? shift.hourlyRate : defaultRate;
      if (!Number.isFinite(rate) || rate < 0) throw new PayrollSourceError('Hourly rate is invalid; review source wages', [sourceId(index)]);
      segments.push({ index, start, day, week: weekDate.toISOString().slice(0, 10), hours: (end.getTime() - start.getTime()) / 3600000, rate, payable: !range || start >= range.start });
      start = end;
    }
  }
  segments.sort((left, right) => left.start.getTime() - right.start.getTime());
  for (let index = 1; index < segments.length; index++) {
    const previous = segments[index - 1];
    if (previous.start.getTime() + previous.hours * 3600000 > segments[index].start.getTime()) throw new PayrollSourceError('Employee work shifts overlap; review source times', [...new Set([sourceId(previous.index), sourceId(segments[index].index)])]);
  }
  const days = new Map<string, number>();
  const weeks = new Map<string, number>();
  let regularHours = 0, overtimeHours = 0, regularPay = 0, overtimePay = 0;
  for (const segment of segments) {
    const dailyUsed = days.get(segment.day) ?? 0;
    const weeklyRegularUsed = weeks.get(segment.week) ?? 0;
    const dailyRemaining = policy.dailyOvertimeHours === null ? Infinity : Math.max(0, policy.dailyOvertimeHours - dailyUsed);
    const regular = Math.min(segment.hours, dailyRemaining, Math.max(0, policy.weeklyOvertimeHours - weeklyRegularUsed));
    const overtime = segment.hours - regular;
    days.set(segment.day, dailyUsed + segment.hours);
    weeks.set(segment.week, weeklyRegularUsed + regular);
    if (segment.payable) {
      regularHours += regular; overtimeHours += overtime;
      regularPay += regular * segment.rate; overtimePay += overtime * segment.rate * 1.5;
      const detail = details[segment.index];
      detail.regularHours += regular; detail.overtimeHours += overtime;
      detail.regularPay += regular * segment.rate; detail.overtimePay += overtime * segment.rate * 1.5;
    }
  }
  const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  let cumulativeRegular = 0, cumulativeOvertime = 0, previousRegular = 0, previousOvertime = 0;
  for (const index of [...shifts.keys()].sort((left, right) => shifts[left].startTime.getTime() - shifts[right].startTime.getTime())) {
    const detail = details[index]; cumulativeRegular += detail.regularPay; cumulativeOvertime += detail.overtimePay;
    detail.regularPay = cents(cumulativeRegular) - previousRegular; detail.overtimePay = cents(cumulativeOvertime) - previousOvertime;
    previousRegular = cents(cumulativeRegular); previousOvertime = cents(cumulativeOvertime);
    detail.regularPay = cents(detail.regularPay); detail.overtimePay = cents(detail.overtimePay); detail.grossPay = cents(detail.regularPay + detail.overtimePay);
  }
  const roundedRegularPay = cents(regularPay);
  const roundedOvertimePay = cents(overtimePay);
  return { totals: { regularHours, overtimeHours, regularPay: roundedRegularPay, overtimePay: roundedOvertimePay, grossPay: cents(roundedRegularPay + roundedOvertimePay) }, details };
}
