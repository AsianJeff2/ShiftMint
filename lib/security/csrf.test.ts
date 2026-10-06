/**
 * CSRF Protection Tests
 *
 * Tests for CSRF token generation and validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  generateCSRFToken,
  validateCSRFToken,
  revokeCSRFToken,
  revokeUserCSRFTokens,
  getCSRFStats,
  generateCSRFMiddleware,
  validateCSRFMiddleware,
  validateCSRFConditionally,
  getCSRFTokenFromRequest,
  hashToken,
} from './csrf';

describe('CSRF Protection', () => {
  describe('generateCSRFToken', () => {
    it('should generate a token and secret', () => {
      const { token, secret } = generateCSRFToken();

      expect(token).toBeDefined();
      expect(secret).toBeDefined();
      expect(typeof token).toBe('string');
      expect(typeof secret).toBe('string');
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
      expect(secret.length).toBe(64);
    });

    it('should generate unique tokens', () => {
      const { token: token1 } = generateCSRFToken();
      const { token: token2 } = generateCSRFToken();

      expect(token1).not.toBe(token2);
    });

    it('should generate unique secrets', () => {
      const { secret: secret1 } = generateCSRFToken();
      const { secret: secret2 } = generateCSRFToken();

      expect(secret1).not.toBe(secret2);
    });

    it('should accept userId parameter', () => {
      const { token, secret } = generateCSRFToken('user-123');

      expect(token).toBeDefined();
      expect(secret).toBeDefined();
    });
  });

  describe('validateCSRFToken', () => {
    it('should validate a valid token', () => {
      const { token, secret } = generateCSRFToken();
      const isValid = validateCSRFToken(token, secret);

      expect(isValid).toBe(true);
    });

    it('should reject invalid token', () => {
      const { secret } = generateCSRFToken();
      const isValid = validateCSRFToken('invalid-token', secret);

      expect(isValid).toBe(false);
    });

    it('should reject invalid secret', () => {
      const { token } = generateCSRFToken();
      const isValid = validateCSRFToken(token, 'invalid-secret');

      expect(isValid).toBe(false);
    });

    it('should reject empty token', () => {
      const isValid = validateCSRFToken('', 'secret');

      expect(isValid).toBe(false);
    });

    it('should reject empty secret', () => {
      const isValid = validateCSRFToken('token', '');

      expect(isValid).toBe(false);
    });

    it('should reject mismatched token and secret', () => {
      const { token: token1 } = generateCSRFToken();
      const { secret: secret2 } = generateCSRFToken();

      const isValid = validateCSRFToken(token1, secret2);

      expect(isValid).toBe(false);
    });
  });

  describe('revokeCSRFToken', () => {
    it('should revoke a token', () => {
      const { token, secret } = generateCSRFToken();

      // Verify token is valid
      expect(validateCSRFToken(token, secret)).toBe(true);

      // Revoke token
      revokeCSRFToken(token);

      // Verify token is now invalid
      expect(validateCSRFToken(token, secret)).toBe(false);
    });
  });

  describe('revokeUserCSRFTokens', () => {
    it('should revoke all tokens for a user', () => {
      const userId = 'user-123';

      // Generate multiple tokens for the same user
      const { token: token1, secret: secret1 } = generateCSRFToken(userId);
      const { token: token2, secret: secret2 } = generateCSRFToken(userId);
      const { token: token3, secret: secret3 } = generateCSRFToken('user-456');

      // Verify all tokens are valid
      expect(validateCSRFToken(token1, secret1)).toBe(true);
      expect(validateCSRFToken(token2, secret2)).toBe(true);
      expect(validateCSRFToken(token3, secret3)).toBe(true);

      // Revoke all tokens for user-123
      revokeUserCSRFTokens(userId);

      // Verify user-123 tokens are revoked, but user-456 is still valid
      expect(validateCSRFToken(token1, secret1)).toBe(false);
      expect(validateCSRFToken(token2, secret2)).toBe(false);
      expect(validateCSRFToken(token3, secret3)).toBe(true);
    });
  });

  describe('getCSRFStats', () => {
    it('should return token statistics', () => {
      // Generate some tokens
      generateCSRFToken();
      generateCSRFToken();

      const stats = getCSRFStats();

      expect(stats.activeTokens).toBeGreaterThanOrEqual(2);
      expect(typeof stats.oldestToken).toBe('number');
    });
  });

  describe('generateCSRFMiddleware', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
      req = {
        user: undefined,
      } as any;

      res = {
        cookie: vi.fn(),
        setHeader: vi.fn(),
      } as any;

      next = vi.fn();
    });

    it('should generate token and set cookie', () => {
      generateCSRFMiddleware(req as Request, res as Response, next);

      expect(res.cookie).toHaveBeenCalledWith(
        'csrf-token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
        })
      );
      expect(res.setHeader).toHaveBeenCalledWith('x-csrf-secret', expect.any(String));
      expect(next).toHaveBeenCalled();
    });

    it('should attach token to request', () => {
      generateCSRFMiddleware(req as Request, res as Response, next);

      expect((req as any).csrfToken).toBeDefined();
      expect(typeof (req as any).csrfToken).toBe('string');
    });

    it('should use userId if authenticated', () => {
      req.user = { userId: 'user-123' } as any;

      generateCSRFMiddleware(req as Request, res as Response, next);

      expect((req as any).csrfToken).toBeDefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('validateCSRFMiddleware', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
      req = {
        method: 'POST',
        path: '/api/test',
        ip: '127.0.0.1',
        cookies: {},
        headers: {},
      } as any;

      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      next = vi.fn();
    });

    it('should skip validation for GET requests', () => {
      req.method = 'GET';

      validateCSRFMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should skip validation for HEAD requests', () => {
      req.method = 'HEAD';

      validateCSRFMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should skip validation for OPTIONS requests', () => {
      req.method = 'OPTIONS';

      validateCSRFMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject POST without token', () => {
      req.method = 'POST';

      validateCSRFMiddleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'MISSING_CSRF_TOKEN',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject POST with invalid token', () => {
      req.method = 'POST';
      req.cookies = { 'csrf-token': 'invalid-token' };
      req.headers = { 'x-csrf-token': 'invalid-secret' };

      validateCSRFMiddleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'INVALID_CSRF_TOKEN',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept POST with valid token', () => {
      const { token, secret } = generateCSRFToken();

      req.method = 'POST';
      req.cookies = { 'csrf-token': token };
      req.headers = { 'x-csrf-token': secret };

      validateCSRFMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should validate PUT requests', () => {
      req.method = 'PUT';

      validateCSRFMiddleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should validate DELETE requests', () => {
      req.method = 'DELETE';

      validateCSRFMiddleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should validate PATCH requests', () => {
      req.method = 'PATCH';

      validateCSRFMiddleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('validateCSRFConditionally', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
      req = {
        method: 'POST',
        path: '/api/test',
        ip: '127.0.0.1',
        cookies: {},
        headers: {},
      } as any;

      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      next = vi.fn();
    });

    it('should validate specified methods', () => {
      const middleware = validateCSRFConditionally(['POST']);

      req.method = 'POST';
      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should skip non-specified methods', () => {
      const middleware = validateCSRFConditionally(['POST']);

      req.method = 'GET';
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should use default methods if none provided', () => {
      const middleware = validateCSRFConditionally();

      req.method = 'DELETE';
      middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('getCSRFTokenFromRequest', () => {
    it('should return token from request', () => {
      const req = {
        csrfToken: 'test-token',
      } as any;

      const token = getCSRFTokenFromRequest(req);

      expect(token).toBe('test-token');
    });

    it('should return undefined if no token', () => {
      const req = {} as any;

      const token = getCSRFTokenFromRequest(req);

      expect(token).toBeUndefined();
    });
  });

  describe('hashToken', () => {
    it('should generate a hash', () => {
      const hash = hashToken('token', 'secret');

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 = 64 hex chars
    });

    it('should generate consistent hashes', () => {
      const hash1 = hashToken('token', 'secret');
      const hash2 = hashToken('token', 'secret');

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = hashToken('token1', 'secret');
      const hash2 = hashToken('token2', 'secret');

      expect(hash1).not.toBe(hash2);
    });
  });
});
