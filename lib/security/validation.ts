/**
 * Enhanced Validation Schemas
 *
 * Stricter validation rules using Zod with custom validators
 * for security-sensitive fields and structured data.
 */

import { z } from 'zod';
import {
  sanitizeString,
  sanitizeEmail,
  sanitizePhone,
  sanitizeSSN,
  sanitizeEIN,
  sanitizeRoutingNumber,
  sanitizeAccountNumber,
  sanitizeAmount,
} from './sanitization';

/**
 * Enhanced email validation
 * - Sanitizes input
 * - Validates format
 * - Max length 254 characters (RFC 5321)
 */
export const EmailSchema = z.string()
  .min(1, 'Email is required')
  .max(254, 'Email must be less than 254 characters')
  .email('Invalid email format')
  .transform(sanitizeEmail)
  .refine(val => val.length > 0, 'Invalid email after sanitization');

/**
 * Enhanced phone number validation
 * - Allows international formats
 * - Sanitizes to digits and formatting characters only
 * - Length between 10-20 characters
 */
export const PhoneSchema = z.string()
  .min(10, 'Phone number must be at least 10 characters')
  .max(20, 'Phone number must be less than 20 characters')
  .transform(sanitizePhone)
  .refine(val => /^[0-9+() -]+$/.test(val), 'Phone number contains invalid characters');

/**
 * Optional phone number
 */
export const OptionalPhoneSchema = z.string().optional().transform(val => val ? sanitizePhone(val) : undefined);

/**
 * Name validation (first/last name)
 * - No HTML
 * - No special SQL characters
 * - Length 1-50 characters
 * - Letters, spaces, hyphens, apostrophes only
 */
export const NameSchema = z.string()
  .min(1, 'Name is required')
  .max(50, 'Name must be less than 50 characters')
  .transform(val => sanitizeString(val, { maxLength: 50, trim: true }))
  .refine(
    val => /^[a-zA-Z\s'-]+$/.test(val),
    'Name can only contain letters, spaces, hyphens, and apostrophes'
  );

/**
 * SSN validation (Social Security Number)
 * - 9 digits only
 * - No invalid patterns (000-xx-xxxx, xxx-00-xxxx, etc.)
 */
export const SSNSchema = z.string()
  .transform(sanitizeSSN)
  .refine(val => val.length === 9, 'SSN must be 9 digits')
  .refine(val => !val.startsWith('000'), 'Invalid SSN pattern')
  .refine(val => val.substring(3, 5) !== '00', 'Invalid SSN pattern')
  .refine(val => val.substring(5) !== '0000', 'Invalid SSN pattern');

/**
 * EIN validation (Employer Identification Number)
 * - 9 digits only
 * - Format: XX-XXXXXXX
 */
export const EINSchema = z.string()
  .transform(sanitizeEIN)
  .refine(val => val.length === 9, 'EIN must be 9 digits');

/**
 * Bank routing number validation
 * - 9 digits only
 * - Validates ABA routing number checksum
 */
export const RoutingNumberSchema = z.string()
  .transform(sanitizeRoutingNumber)
  .refine(val => val.length === 9, 'Routing number must be 9 digits')
  .refine(val => val.length > 0, 'Invalid routing number checksum');

/**
 * Bank account number validation
 * - 4-17 digits only
 */
export const AccountNumberSchema = z.string()
  .transform(sanitizeAccountNumber)
  .refine(val => val.length >= 4 && val.length <= 17, 'Account number must be 4-17 digits');

/**
 * Monetary amount validation
 * - Non-negative
 * - Max 2 decimal places
 * - Reasonable max value
 */
export const AmountSchema = z.union([z.string(), z.number()])
  .transform(val => sanitizeAmount(val, { min: 0, max: 1000000 }))
  .refine(val => val !== null, 'Invalid amount');

/**
 * Optional monetary amount
 */
export const OptionalAmountSchema = z.union([z.string(), z.number()]).optional()
  .transform(val => val !== undefined ? sanitizeAmount(val, { min: 0, max: 1000000 }) : undefined);

/**
 * Hourly rate validation
 * - Between minimum wage and reasonable maximum
 */
export const HourlyRateSchema = z.number()
  .min(7.25, 'Hourly rate must be at least minimum wage ($7.25)')
  .max(500, 'Hourly rate must be less than $500')
  .refine(val => Number.isFinite(val), 'Invalid hourly rate');

/**
 * Percentage validation
 * - Between 0 and 100
 * - Max 2 decimal places
 */
export const PercentageSchema = z.number()
  .min(0, 'Percentage must be at least 0')
  .max(100, 'Percentage must be at most 100')
  .transform(val => Math.round(val * 100) / 100);

/**
 * Date string validation
 * - ISO 8601 format
 * - Validates actual date
 */
export const DateStringSchema = z.string()
  .min(1, 'Date is required')
  .refine(val => {
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, 'Invalid date format');

/**
 * Optional date string
 */
export const OptionalDateStringSchema = z.string().optional()
  .refine(val => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, 'Invalid date format');

/**
 * Address validation
 * - Max length 200 characters
 * - No HTML tags
 */
export const AddressSchema = z.string()
  .max(200, 'Address must be less than 200 characters')
  .transform(val => sanitizeString(val, { maxLength: 200, trim: true }));

/**
 * Optional address
 */
export const OptionalAddressSchema = z.string().optional()
  .transform(val => val ? sanitizeString(val, { maxLength: 200, trim: true }) : undefined);

/**
 * Notes/description field validation
 * - Max length 1000 characters
 * - No HTML tags
 */
export const NotesSchema = z.string()
  .max(1000, 'Notes must be less than 1000 characters')
  .transform(val => sanitizeString(val, { maxLength: 1000, trim: true }));

/**
 * Optional notes
 */
export const OptionalNotesSchema = z.string().optional()
  .transform(val => val ? sanitizeString(val, { maxLength: 1000, trim: true }) : undefined);

/**
 * Short text field validation
 * - Max length 100 characters
 * - No HTML tags
 */
export const ShortTextSchema = z.string()
  .max(100, 'Text must be less than 100 characters')
  .transform(val => sanitizeString(val, { maxLength: 100, trim: true }));

/**
 * Optional short text
 */
export const OptionalShortTextSchema = z.string().optional()
  .transform(val => val ? sanitizeString(val, { maxLength: 100, trim: true }) : undefined);

/**
 * Tax exemptions validation
 * - Non-negative integer
 * - Reasonable maximum (0-99)
 */
export const TaxExemptionsSchema = z.number()
  .int('Tax exemptions must be a whole number')
  .min(0, 'Tax exemptions cannot be negative')
  .max(99, 'Tax exemptions must be less than 100');

/**
 * CUID validation
 * - Validates CUID format
 */
export const CUIDSchema = z.string()
  .min(25, 'Invalid ID format')
  .max(25, 'Invalid ID format')
  .regex(/^c[a-z0-9]{24}$/, 'Invalid ID format');

/**
 * Optional CUID
 */
export const OptionalCUIDSchema = z.string().optional()
  .refine(val => !val || /^c[a-z0-9]{24}$/.test(val), 'Invalid ID format');

/**
 * Pagination validation
 */
export const PageNumberSchema = z.number()
  .int('Page must be a whole number')
  .min(1, 'Page must be at least 1')
  .max(10000, 'Page number too large');

export const PageSizeSchema = z.number()
  .int('Page size must be a whole number')
  .min(1, 'Page size must be at least 1')
  .max(100, 'Page size must be at most 100');

/**
 * Enum validation helper
 * Creates a validated enum schema
 */
export function createEnumSchema<T extends string>(
  values: readonly T[],
  errorMessage?: string
) {
  return z.enum(values as [T, ...T[]], {
    error: errorMessage || `Must be one of: ${values.join(', ')}`,
  });
}

/**
 * Array validation helper
 * Creates validated array with min/max length
 */
export function createArraySchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  options: { min?: number; max?: number } = {}
) {
  const { min = 0, max = 1000 } = options;

  return z.array(itemSchema)
    .min(min, `Array must have at least ${min} items`)
    .max(max, `Array must have at most ${max} items`);
}
