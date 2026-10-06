/**
 * Input Sanitization and XSS Protection
 *
 * Provides utilities to sanitize user inputs and prevent XSS attacks.
 * Uses DOMPurify for HTML sanitization and custom validators for structured data.
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitization options
 */
export interface SanitizeOptions {
  /**
   * Allow HTML tags (sanitized)
   * If false, strips all HTML
   */
  allowHTML?: boolean;

  /**
   * Maximum length for the string
   */
  maxLength?: number;

  /**
   * Trim whitespace
   */
  trim?: boolean;
}

/**
 * Sanitize a string input to prevent XSS
 *
 * @param input - User input string
 * @param options - Sanitization options
 * @returns Sanitized string
 */
export function sanitizeString(
  input: string | null | undefined,
  options: SanitizeOptions = {}
): string {
  if (!input) return '';

  const {
    allowHTML = false,
    maxLength = 10000,
    trim = true,
  } = options;

  let sanitized = input;

  // Trim whitespace
  if (trim) {
    sanitized = sanitized.trim();
  }

  // Sanitize HTML
  if (allowHTML) {
    // Allow safe HTML tags, remove scripts and dangerous attributes
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href'],
      ALLOW_DATA_ATTR: false,
    });
  } else {
    // Strip all HTML tags
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  }

  // Enforce maximum length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize an email address
 * Validates format and sanitizes
 *
 * @param email - Email address
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (!email) return '';

  const sanitized = sanitizeString(email, { trim: true, maxLength: 254 });

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    return '';
  }

  return sanitized.toLowerCase();
}

/**
 * Sanitize a phone number
 * Removes all non-digit characters except + and ()
 *
 * @param phone - Phone number
 * @returns Sanitized phone number
 */
export function sanitizePhone(phone: string | null | undefined): string {
  if (!phone) return '';

  // Remove all characters except digits, +, (, ), -, and spaces
  let sanitized = phone.replace(/[^0-9+() -]/g, '');

  // Trim and limit length
  sanitized = sanitized.trim().substring(0, 20);

  return sanitized;
}

/**
 * Sanitize a URL
 * Validates and sanitizes URLs, prevents javascript: and data: schemes
 *
 * @param url - URL string
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeURL(url: string | null | undefined): string {
  if (!url) return '';

  const sanitized = sanitizeString(url, { trim: true, maxLength: 2048 });

  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  const lowerURL = sanitized.toLowerCase();

  for (const protocol of dangerousProtocols) {
    if (lowerURL.startsWith(protocol)) {
      return '';
    }
  }

  // Only allow http, https, mailto, and relative URLs
  if (sanitized.includes(':')) {
    const allowedProtocols = ['http:', 'https:', 'mailto:'];
    const hasAllowedProtocol = allowedProtocols.some(p => lowerURL.startsWith(p));
    if (!hasAllowedProtocol) {
      return '';
    }
  }

  return sanitized;
}

/**
 * Sanitize a US SSN (Social Security Number)
 * Validates format and removes formatting characters
 *
 * @param ssn - SSN string
 * @returns Sanitized SSN (digits only) or empty string if invalid
 */
export function sanitizeSSN(ssn: string | null | undefined): string {
  if (!ssn) return '';

  // Remove all non-digit characters
  const digitsOnly = ssn.replace(/\D/g, '');

  // SSN must be exactly 9 digits
  if (digitsOnly.length !== 9) {
    return '';
  }

  return digitsOnly;
}

/**
 * Sanitize a US EIN (Employer Identification Number)
 * Validates format: XX-XXXXXXX
 *
 * @param ein - EIN string
 * @returns Sanitized EIN or empty string if invalid
 */
export function sanitizeEIN(ein: string | null | undefined): string {
  if (!ein) return '';

  // Remove all non-digit characters
  const digitsOnly = ein.replace(/\D/g, '');

  // EIN must be exactly 9 digits
  if (digitsOnly.length !== 9) {
    return '';
  }

  return digitsOnly;
}

/**
 * Sanitize a US bank routing number
 * Validates 9-digit ABA routing number with checksum
 *
 * @param routing - Routing number
 * @returns Sanitized routing number or empty string if invalid
 */
export function sanitizeRoutingNumber(routing: string | null | undefined): string {
  if (!routing) return '';

  // Remove all non-digit characters
  const digitsOnly = routing.replace(/\D/g, '');

  // Routing number must be exactly 9 digits
  if (digitsOnly.length !== 9) {
    return '';
  }

  // Validate checksum (ABA routing number algorithm)
  const digits = digitsOnly.split('').map(Number);
  const checksum = (
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    1 * (digits[2] + digits[5] + digits[8])
  ) % 10;

  if (checksum !== 0) {
    return '';
  }

  return digitsOnly;
}

/**
 * Sanitize a bank account number
 * Removes non-digits and validates length
 *
 * @param account - Account number
 * @returns Sanitized account number or empty string if invalid
 */
export function sanitizeAccountNumber(account: string | null | undefined): string {
  if (!account) return '';

  // Remove all non-digit characters
  const digitsOnly = account.replace(/\D/g, '');

  // Account number should be 4-17 digits
  if (digitsOnly.length < 4 || digitsOnly.length > 17) {
    return '';
  }

  return digitsOnly;
}

/**
 * Sanitize an object recursively
 * Applies sanitization to all string values
 *
 * @param obj - Object to sanitize
 * @param options - Sanitization options
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  options: SanitizeOptions = {}
): T {
  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value, options);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value, options);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string'
          ? sanitizeString(item, options)
          : typeof item === 'object' && item !== null
          ? sanitizeObject(item, options)
          : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/**
 * Validate and sanitize a monetary amount
 * Ensures positive number with max 2 decimal places
 *
 * @param amount - Amount as string or number
 * @param options - Validation options
 * @returns Validated amount or null if invalid
 */
export function sanitizeAmount(
  amount: string | number | null | undefined,
  options: { min?: number; max?: number } = {}
): number | null {
  if (amount === null || amount === undefined || amount === '') {
    return null;
  }

  const { min = 0, max = 1000000000 } = options;

  // Convert to number
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Validate
  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  if (num < min || num > max) {
    return null;
  }

  // Round to 2 decimal places
  return Math.round(num * 100) / 100;
}

/**
 * Sanitize a date string
 * Validates ISO 8601 format
 *
 * @param date - Date string
 * @returns Sanitized date string or empty string if invalid
 */
export function sanitizeDate(date: string | null | undefined): string {
  if (!date) return '';

  const sanitized = sanitizeString(date, { trim: true, maxLength: 50 });

  // Try to parse as date
  const parsed = new Date(sanitized);
  if (isNaN(parsed.getTime())) {
    return '';
  }

  // Return ISO string
  return parsed.toISOString();
}

/**
 * Strip SQL keywords and special characters
 * Additional protection layer (Prisma already prevents SQL injection)
 *
 * @param input - User input
 * @returns Sanitized input
 */
export function stripSQLKeywords(input: string | null | undefined): string {
  if (!input) return '';

  // Prisma handles this, but extra safety never hurts
  const sqlKeywords = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
    'EXEC', 'EXECUTE', 'UNION', 'DECLARE', 'SCRIPT',
  ];

  const sqlChars = ['--', ';', '/*', '*/'];

  let sanitized = sanitizeString(input);

  // Remove SQL keywords
  for (const keyword of sqlKeywords) {
    const regex = new RegExp(keyword, 'gi');
    sanitized = sanitized.replace(regex, '');
  }

  // Remove SQL special characters (escape regex special chars)
  for (const char of sqlChars) {
    const escaped = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    sanitized = sanitized.replace(regex, '');
  }

  return sanitized;
}
