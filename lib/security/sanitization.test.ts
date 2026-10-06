/**
 * Sanitization Tests
 *
 * Tests for input sanitization and XSS protection
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  sanitizeEmail,
  sanitizePhone,
  sanitizeSSN,
  sanitizeEIN,
  sanitizeRoutingNumber,
  sanitizeAccountNumber,
  sanitizeAmount,
  sanitizeURL,
  sanitizeObject,
  stripSQLKeywords,
} from './sanitization';

describe('Sanitization', () => {
  describe('sanitizeString', () => {
    it('should strip HTML tags by default', () => {
      const input = '<script>alert("XSS")</script>Hello';
      const result = sanitizeString(input);
      expect(result).toBe('Hello');
      expect(result).not.toContain('<script>');
    });

    it('should remove malicious script tags', () => {
      const malicious = '<img src=x onerror="alert(1)">';
      const result = sanitizeString(malicious);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    });

    it('should allow safe HTML when enabled', () => {
      const input = '<b>Bold</b> and <script>bad</script>';
      const result = sanitizeString(input, { allowHTML: true });
      expect(result).toContain('<b>Bold</b>');
      expect(result).not.toContain('<script>');
    });

    it('should trim whitespace', () => {
      const input = '  hello  ';
      const result = sanitizeString(input, { trim: true });
      expect(result).toBe('hello');
    });

    it('should enforce max length', () => {
      const input = 'a'.repeat(1000);
      const result = sanitizeString(input, { maxLength: 100 });
      expect(result.length).toBe(100);
    });

    it('should handle null and undefined', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });
  });

  describe('sanitizeEmail', () => {
    it('should validate and sanitize valid emails', () => {
      expect(sanitizeEmail('test@example.com')).toBe('test@example.com');
      expect(sanitizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
    });

    it('should reject invalid emails', () => {
      expect(sanitizeEmail('not-an-email')).toBe('');
      expect(sanitizeEmail('missing@domain')).toBe('');
      expect(sanitizeEmail('@example.com')).toBe('');
    });

    it('should strip HTML from emails', () => {
      expect(sanitizeEmail('<script>test@example.com</script>')).toBe('');
    });

    it('should handle null', () => {
      expect(sanitizeEmail(null)).toBe('');
    });
  });

  describe('sanitizePhone', () => {
    it('should sanitize valid phone numbers', () => {
      expect(sanitizePhone('(555) 123-4567')).toBe('(555) 123-4567');
      expect(sanitizePhone('+1-555-123-4567')).toBe('+1-555-123-4567');
    });

    it('should remove invalid characters', () => {
      expect(sanitizePhone('555-ABC-1234')).toBe('555--1234');
    });

    it('should enforce max length', () => {
      const long = '1'.repeat(100);
      expect(sanitizePhone(long).length).toBeLessThanOrEqual(20);
    });
  });

  describe('sanitizeSSN', () => {
    it('should validate and sanitize valid SSN', () => {
      expect(sanitizeSSN('123-45-6789')).toBe('123456789');
      expect(sanitizeSSN('123456789')).toBe('123456789');
    });

    it('should reject invalid SSN lengths', () => {
      expect(sanitizeSSN('12345')).toBe('');
      expect(sanitizeSSN('1234567890')).toBe('');
    });

    it('should remove formatting', () => {
      expect(sanitizeSSN('123-45-6789')).toBe('123456789');
    });
  });

  describe('sanitizeEIN', () => {
    it('should validate and sanitize valid EIN', () => {
      expect(sanitizeEIN('12-3456789')).toBe('123456789');
      expect(sanitizeEIN('123456789')).toBe('123456789');
    });

    it('should reject invalid EIN lengths', () => {
      expect(sanitizeEIN('12345')).toBe('');
      expect(sanitizeEIN('1234567890')).toBe('');
    });
  });

  describe('sanitizeRoutingNumber', () => {
    it('should validate valid routing numbers', () => {
      // Example valid routing number (Bank of America)
      expect(sanitizeRoutingNumber('111000025')).toBe('111000025');
    });

    it('should reject invalid checksums', () => {
      expect(sanitizeRoutingNumber('123456789')).toBe('');
    });

    it('should reject invalid lengths', () => {
      expect(sanitizeRoutingNumber('12345')).toBe('');
      expect(sanitizeRoutingNumber('1234567890')).toBe('');
    });
  });

  describe('sanitizeAccountNumber', () => {
    it('should validate valid account numbers', () => {
      expect(sanitizeAccountNumber('12345678')).toBe('12345678');
      expect(sanitizeAccountNumber('123456789012345')).toBe('123456789012345');
    });

    it('should reject too short account numbers', () => {
      expect(sanitizeAccountNumber('123')).toBe('');
    });

    it('should reject too long account numbers', () => {
      expect(sanitizeAccountNumber('123456789012345678')).toBe('');
    });

    it('should remove non-digits', () => {
      expect(sanitizeAccountNumber('1234-5678')).toBe('12345678');
    });
  });

  describe('sanitizeAmount', () => {
    it('should validate valid amounts', () => {
      expect(sanitizeAmount(100)).toBe(100);
      expect(sanitizeAmount('100.50')).toBe(100.50);
      expect(sanitizeAmount('100.555')).toBe(100.56); // Rounds to 2 decimals
    });

    it('should reject negative amounts', () => {
      expect(sanitizeAmount(-100)).toBe(null);
    });

    it('should reject amounts exceeding max', () => {
      expect(sanitizeAmount(2000000000)).toBe(null);
    });

    it('should reject invalid amounts', () => {
      expect(sanitizeAmount('not-a-number')).toBe(null);
      expect(sanitizeAmount(NaN)).toBe(null);
      expect(sanitizeAmount(Infinity)).toBe(null);
    });

    it('should handle null and undefined', () => {
      expect(sanitizeAmount(null)).toBe(null);
      expect(sanitizeAmount(undefined)).toBe(null);
    });
  });

  describe('sanitizeURL', () => {
    it('should allow valid HTTP(S) URLs', () => {
      expect(sanitizeURL('https://example.com')).toBe('https://example.com');
      expect(sanitizeURL('http://example.com/path')).toBe('http://example.com/path');
    });

    it('should block dangerous protocols', () => {
      expect(sanitizeURL('javascript:alert(1)')).toBe('');
      expect(sanitizeURL('data:text/html,<script>alert(1)</script>')).toBe('');
      expect(sanitizeURL('vbscript:msgbox(1)')).toBe('');
    });

    it('should allow mailto links', () => {
      expect(sanitizeURL('mailto:test@example.com')).toBe('mailto:test@example.com');
    });

    it('should allow relative URLs', () => {
      expect(sanitizeURL('/path/to/resource')).toBe('/path/to/resource');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string fields', () => {
      const input = {
        name: '  <script>alert(1)</script>John  ',
        email: 'test@example.com',
        age: 25,
      };

      const result = sanitizeObject(input);
      expect(result.name).toBe('John');
      expect(result.name).not.toContain('<script>');
      expect(result.email).toBe('test@example.com');
      expect(result.age).toBe(25);
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: '<b>John</b>',
          profile: {
            bio: '<script>alert(1)</script>Hello',
          },
        },
      };

      const result = sanitizeObject(input);
      expect(result.user.name).toBe('John');
      expect(result.user.profile.bio).toBe('Hello');
    });

    it('should handle arrays', () => {
      const input = {
        tags: ['  tag1  ', 'tag2 text', '<b>tag3</b>'],
      };

      const result = sanitizeObject(input);
      expect(result.tags[0]).toBe('tag1');
      expect(result.tags[1]).toBe('tag2 text');
      expect(result.tags[2]).toBe('tag3'); // <b> tags stripped
    });
  });

  describe('stripSQLKeywords', () => {
    it('should remove SQL injection attempts', () => {
      const input = "John'; DROP TABLE users; --";
      const result = stripSQLKeywords(input);
      expect(result).not.toContain('DROP');
      expect(result).not.toContain('--');
    });

    it('should remove UNION attacks', () => {
      const input = "admin' UNION SELECT * FROM passwords";
      const result = stripSQLKeywords(input);
      expect(result).not.toContain('UNION');
      expect(result).not.toContain('SELECT');
    });

    it('should preserve normal text', () => {
      const input = 'John Doe';
      const result = stripSQLKeywords(input);
      expect(result).toBe('John Doe');
    });
  });
});
