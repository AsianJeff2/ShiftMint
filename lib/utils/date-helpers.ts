/**
 * Date utility helpers for consistent date handling
 * Converts between Date objects and ISO string representations
 */

/**
 * Converts a Date object to ISO string for API calls
 * @param date - Date object or ISO string
 * @returns ISO string representation
 */
export function toISOString(date: Date | string): string {
  if (typeof date === 'string') {
    return date;
  }
  return date.toISOString();
}

/**
 * Converts ISO string to Date object
 * @param isoString - ISO string or Date object
 * @returns Date object
 */
export function toDate(isoString: string | Date): Date {
  if (isoString instanceof Date) {
    return isoString;
  }
  return new Date(isoString);
}

/**
 * Formats a date as YYYY-MM-DD for shift dates
 * @param date - Date object or ISO string
 * @returns Date string in YYYY-MM-DD format
 */
export function toDateString(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().split('T')[0];
}

/**
 * Converts Date fields in an object to ISO strings for API submission
 * @param obj - Object with potential Date fields
 * @returns Object with Date fields converted to ISO strings
 */
export function datesForAPI<T extends Record<string, any>>(obj: T): T {
  const result = { ...obj };

  for (const key in result) {
    const value: any = result[key];
    if (value instanceof Date) {
      (result as any)[key] = value.toISOString();
    }
  }

  return result;
}

/**
 * Gets current timestamp as ISO string
 * @returns Current time as ISO string
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Gets current date as YYYY-MM-DD string
 * @returns Current date as YYYY-MM-DD
 */
export function todayString(): string {
  return toDateString(new Date());
}
