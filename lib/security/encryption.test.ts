/**
 * Encryption Utility Tests
 *
 * Tests for field-level encryption/decryption functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encrypt, decrypt, isEncrypted, encryptBatch, decryptBatch, generateEncryptionKey, encryptedField } from './encryption';

describe('Encryption', () => {
  beforeEach(() => vi.stubEnv('ENCRYPTION_KEY', '1'.repeat(64)));
  afterEach(() => vi.unstubAllEnvs());
  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'Secret Bank Account: 123456789';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const plaintext = 'test data';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      // Different IVs mean different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);

      // But both decrypt to same plaintext
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle null values', () => {
      expect(encrypt(null)).toBe(null);
      expect(encrypt(undefined)).toBe(null);
      expect(decrypt(null)).toBe(null);
      expect(decrypt(undefined)).toBe(null);
    });

    it('should handle empty strings', () => {
      expect(encrypt('')).toBe(null);
      expect(decrypt('')).toBe(null);
    });

    it('should handle special characters', () => {
      const plaintext = 'Test!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '测试数据 🔒 Тест';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce ciphertext in correct format', () => {
      const plaintext = 'test';
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeTruthy();

      if (encrypted) {
        expect(encrypted.startsWith('v1:')).toBe(true);
        const parts = encrypted.slice(3).split(':');
        expect(parts).toHaveLength(3);

        // All parts should be hex strings
        const hexRegex = /^[0-9a-f]+$/i;
        expect(hexRegex.test(parts[0])).toBe(true); // IV
        expect(hexRegex.test(parts[1])).toBe(true); // Auth tag
        expect(hexRegex.test(parts[2])).toBe(true); // Ciphertext
      }
    });
  });

  describe('isEncrypted', () => {
    it('should detect encrypted data', () => {
      const plaintext = 'test data';
      const encrypted = encrypt(plaintext);

      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should detect plaintext as not encrypted', () => {
      expect(isEncrypted('regular text')).toBe(false);
      expect(isEncrypted('123456789')).toBe(false);
      expect(isEncrypted('test@example.com')).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
    });

    it('should detect incorrect format as not encrypted', () => {
      expect(isEncrypted('abc:def')).toBe(false); // Missing part
      expect(isEncrypted('abc:def:ghi:jkl')).toBe(false); // Too many parts
      expect(isEncrypted('notHex:alsoNotHex:stillNotHex')).toBe(false); // Not hex
    });
  });

  describe('batch operations', () => {
    it('should encrypt multiple values', () => {
      const values = ['test1', 'test2', 'test3'];
      const encrypted = encryptBatch(values);

      expect(encrypted).toHaveLength(3);
      encrypted.forEach((enc, i) => {
        expect(decrypt(enc)).toBe(values[i]);
      });
    });

    it('should decrypt multiple values', () => {
      const values = ['test1', 'test2', 'test3'];
      const encrypted = encryptBatch(values);
      const decrypted = decryptBatch(encrypted);

      expect(decrypted).toEqual(values);
    });

    it('should handle mixed null values in batch', () => {
      const values = ['test1', null, 'test3', undefined];
      const encrypted = encryptBatch(values);
      const decrypted = decryptBatch(encrypted);

      expect(decrypted[0]).toBe('test1');
      expect(decrypted[1]).toBe(null);
      expect(decrypted[2]).toBe('test3');
      expect(decrypted[3]).toBe(null);
    });
  });

  describe('encryptedField helper', () => {
    it('should provide toDatabase helper', () => {
      const plaintext = 'sensitive data';
      const encrypted = encryptedField.toDatabase(plaintext);

      expect(isEncrypted(encrypted)).toBe(true);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    it('should provide fromDatabase helper', () => {
      const plaintext = 'sensitive data';
      const encrypted = encrypt(plaintext);
      const decrypted = encryptedField.fromDatabase(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle null in helpers', () => {
      expect(encryptedField.toDatabase(null)).toBe(null);
      expect(encryptedField.fromDatabase(null)).toBe(undefined);
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate valid encryption key', () => {
      const key = generateEncryptionKey();

      // Should be 64 hex characters
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/i.test(key)).toBe(true);
    });

    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('error handling', () => {
    it('should handle decryption of corrupted data gracefully', () => {
      const corrupted = 'v1:abc123:def456:ghi789';

      expect(() => decrypt(corrupted)).toThrow();
    });

    it('should handle decryption with wrong key', () => {
      const ciphertext = encrypt('private data');
      vi.stubEnv('ENCRYPTION_KEY', '2'.repeat(64));
      expect(() => decrypt(ciphertext)).toThrow();
    });
    it('requires an explicit valid key in development too', () => {
      vi.stubEnv('ENCRYPTION_KEY', '');
      expect(() => encrypt('private data')).toThrow();
      vi.stubEnv('ENCRYPTION_KEY', 'z'.repeat(64));
      expect(() => encrypt('private data')).toThrow();
    });
    it('reads legacy unprefixed authenticated ciphertext', () => {
      const ciphertext = encrypt('old database value')!;
      expect(decrypt(ciphertext.slice(3))).toBe('old database value');
    });
  });

  describe('data format compatibility', () => {
    it('should decrypt plaintext from before encryption was enabled', () => {
      // Simulates legacy data that wasn't encrypted
      const legacyData = '123456789';
      const result = decrypt(legacyData);

      // Should return as-is with a warning (logged)
      expect(result).toBe(legacyData);
    });
  });
});
