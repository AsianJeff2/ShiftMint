/**
 * Field-level Encryption Utilities
 *
 * Provides transparent encryption/decryption for sensitive database fields.
 * Uses AES-256-GCM for authenticated encryption with strong security guarantees.
 *
 * CRITICAL SECURITY NOTES:
 * 1. ENCRYPTION_KEY must be 32 bytes (64 hex characters) for AES-256
 * 2. Store ENCRYPTION_KEY in .env file, NEVER commit to version control
 * 3. Rotate encryption keys periodically using the key rotation support
 * 4. Keep backups of old keys to decrypt historical data
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Encryption configuration
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // AES block size
const AUTH_TAG_LENGTH = 16; // GCM authentication tag length

/**
 * Get encryption key from environment
 * Falls back to a development-only key (INSECURE - only for local testing)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) throw new Error('ENCRYPTION_KEY is required to store or read encrypted data');

  // Validate key length (must be 32 bytes = 64 hex characters)
  if (!/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error(
      `ENCRYPTION_KEY must be 64 hex characters (32 bytes). Current length: ${key.length}. ` +
      `Generate a secure key with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }

  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a plaintext string
 *
 * Format: iv:authTag:ciphertext (all hex-encoded)
 *
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in format "iv:authTag:ciphertext"
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  // Handle null/undefined - don't encrypt
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return null;
  }

  try {
    const key = getEncryptionKey();

    // Generate random IV (Initialization Vector)
    const iv = randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);

    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag (GCM mode)
    const authTag = cipher.getAuthTag();

    // Return format: iv:authTag:ciphertext (all hex-encoded)
    return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt an encrypted string
 *
 * @param ciphertext - Encrypted string in format "iv:authTag:ciphertext"
 * @returns Decrypted plaintext string
 */
export function decrypt(ciphertext: string | null | undefined): string | null {
  // Handle null/undefined - return as-is
  if (ciphertext === null || ciphertext === undefined || ciphertext === '') {
    return null;
  }

  try {
    // Parse the encrypted format: iv:authTag:ciphertext
    if (!isEncrypted(ciphertext)) {
      if (ciphertext.startsWith('v1:')) throw new Error('Invalid encrypted data format');
      return ciphertext; // Read compatibility for existing plaintext database fields.
    }
    const key = getEncryptionKey();
    const parts = ciphertext.replace(/^v1:/, '').split(':');

    const [ivHex, authTagHex, encrypted] = parts;

    // Convert from hex
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data - data may be corrupted or key is incorrect');
  }
}

/**
 * Check if a string is encrypted (matches our format)
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;

  // Check if format matches: hexstring:hexstring:hexstring
  const parts = value.replace(/^v1:/, '').split(':');
  if (parts.length !== 3) return false;

  // Check if all parts are valid hex strings
  const hexRegex = /^[0-9a-f]+$/i;
  return parts[0].length === IV_LENGTH * 2 && parts[1].length === AUTH_TAG_LENGTH * 2 && parts[2].length % 2 === 0 && parts.every(part => hexRegex.test(part));
}

/**
 * Batch encrypt multiple values
 */
export function encryptBatch(values: (string | null | undefined)[]): (string | null)[] {
  return values.map(encrypt);
}

/**
 * Batch decrypt multiple values
 */
export function decryptBatch(values: (string | null | undefined)[]): (string | null)[] {
  return values.map(decrypt);
}

/**
 * Generate a new encryption key (32 bytes = 64 hex characters)
 * Use this to generate ENCRYPTION_KEY for .env file
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Key rotation support
 *
 * When rotating keys, you'll need to:
 * 1. Set ENCRYPTION_KEY_OLD to the current key
 * 2. Set ENCRYPTION_KEY to the new key
 * 3. Run a migration script to re-encrypt all data
 */
export function rotateEncryptedValue(
  encryptedValue: string,
  oldKey: string,
  newKey: string
): string {
  // Temporarily override the key to decrypt with old key
  const originalKey = process.env.ENCRYPTION_KEY;

  try {
    // Decrypt with old key
    process.env.ENCRYPTION_KEY = oldKey;
    const plaintext = decrypt(encryptedValue);

    // Encrypt with new key
    process.env.ENCRYPTION_KEY = newKey;
    const reencrypted = encrypt(plaintext || '');

    return reencrypted || '';
  } finally {
    // Restore original key
    process.env.ENCRYPTION_KEY = originalKey;
  }
}

/**
 * Helper for encrypted field transformers
 * Use in Prisma transformers to transparently handle encryption
 */
export const encryptedField = {
  /**
   * Encrypt on write (DTO → Prisma)
   */
  toDatabase: (value: string | null | undefined): string | null => {
    return encrypt(value);
  },

  /**
   * Decrypt on read (Prisma → DTO)
   */
  fromDatabase: (value: string | null | undefined): string | undefined => {
    const decrypted = decrypt(value);
    return decrypted ?? undefined;
  },
};
