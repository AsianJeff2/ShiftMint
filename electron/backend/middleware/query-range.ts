import { businessDateRange } from './payroll-policy';

export class RequestRangeError extends Error {}
/** Calendar filters use venue midnights; explicit instants preserve the supplied offset. */
export function queryRange(start: unknown, end: unknown, timeZone: string): { start?: Date; endExclusive?: Date } {
  const parse = (value: unknown, last: boolean): Date | undefined => {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !value) throw new RequestRangeError('Dates must be YYYY-MM-DD or timestamps with an explicit timezone');
    const calendar = /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!calendar && !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new RequestRangeError('Dates must be YYYY-MM-DD or timestamps with an explicit timezone');
    const marker = new Date(value);
    if (!Number.isFinite(marker.getTime()) || (calendar && marker.toISOString().slice(0, 10) !== value)) throw new RequestRangeError('Invalid date');
    return calendar ? businessDateRange(marker, marker, timeZone)[last ? 'endExclusive' : 'start'] : marker;
  };
  const range = { start: parse(start, false), endExclusive: parse(end, true) };
  if (range.start && range.endExclusive && range.start >= range.endExclusive) throw new RequestRangeError('Start must precede the end of the date range');
  return range;
}
export function pageInteger(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > maximum) throw new RequestRangeError('Invalid pagination');
  return Number(value);
}
