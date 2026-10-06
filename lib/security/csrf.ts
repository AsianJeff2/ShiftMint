/**
 * CSRF (Cross-Site Request Forgery) Protection
 *
 * Implements CSRF token generation and validation for state-changing operations.
 * Uses double-submit cookie pattern with additional server-side validation.
 */

import { randomBytes, createHash } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../infrastructure/Logger';

/**
 * CSRF token configuration
 */
const CSRF_TOKEN_LENGTH = 32; // 256 bits
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_SECRET_HEADER = 'x-csrf-secret';

/**
 * Token store for server-side validation
 * In production, this should be Redis or similar
 */
interface TokenEntry {
  secret: string;
  createdAt: number;
  userId?: string;
}

class CSRFTokenStore {
  private tokens: Map<string, TokenEntry> = new Map();
  private readonly tokenTTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Store a token with its secret
   */
  store(token: string, secret: string, userId?: string): void {
    this.tokens.set(token, {
      secret,
      createdAt: Date.now(),
      userId,
    });
    this.cleanup();
  }

  /**
   * Validate a token against its secret
   */
  validate(token: string, secret: string): boolean {
    const entry = this.tokens.get(token);
    if (!entry) {
      return false;
    }

    // Check if token expired
    if (Date.now() - entry.createdAt > this.tokenTTL) {
      this.tokens.delete(token);
      return false;
    }

    // Validate secret
    return entry.secret === secret;
  }

  /**
   * Remove a token
   */
  remove(token: string): void {
    this.tokens.delete(token);
  }

  /**
   * Remove all tokens for a user (on logout)
   */
  removeUserTokens(userId: string): void {
    for (const [token, entry] of this.tokens.entries()) {
      if (entry.userId === userId) {
        this.tokens.delete(token);
      }
    }
  }

  /**
   * Clean up expired tokens
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [token, entry] of this.tokens.entries()) {
      if (now - entry.createdAt > this.tokenTTL) {
        this.tokens.delete(token);
      }
    }
  }

  /**
   * Get statistics
   */
  getStats(): { activeTokens: number; oldestToken: number | null } {
    this.cleanup();
    let oldestToken: number | null = null;
    for (const entry of this.tokens.values()) {
      if (oldestToken === null || entry.createdAt < oldestToken) {
        oldestToken = entry.createdAt;
      }
    }
    return {
      activeTokens: this.tokens.size,
      oldestToken,
    };
  }
}

// Global token store
const tokenStore = new CSRFTokenStore();

/**
 * Generate a CSRF token pair (token + secret)
 */
export function generateCSRFToken(userId?: string): {
  token: string;
  secret: string;
} {
  const token = randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  const secret = randomBytes(CSRF_TOKEN_LENGTH).toString('hex');

  // Store the token-secret pair
  tokenStore.store(token, secret, userId);

  return { token, secret };
}

/**
 * Validate a CSRF token
 */
export function validateCSRFToken(token: string, secret: string): boolean {
  if (!token || !secret) {
    return false;
  }

  return tokenStore.validate(token, secret);
}

/**
 * Revoke a CSRF token
 */
export function revokeCSRFToken(token: string): void {
  tokenStore.remove(token);
}

/**
 * Revoke all CSRF tokens for a user (call on logout)
 */
export function revokeUserCSRFTokens(userId: string): void {
  tokenStore.removeUserTokens(userId);
}

/**
 * Get CSRF token store statistics
 */
export function getCSRFStats() {
  return tokenStore.getStats();
}

/**
 * Middleware to generate and send CSRF token
 * Apply this to routes that render forms or return pages
 *
 * Usage:
 *   app.get('/login', generateCSRFMiddleware, (req, res) => { ... })
 */
export function generateCSRFMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const userId = (req as any).user?.userId;
  const { token, secret } = generateCSRFToken(userId);

  // Set token in cookie (HttpOnly for security)
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  // Also send secret in header for client-side storage
  res.setHeader(CSRF_SECRET_HEADER, secret);

  // Attach token to request for convenience
  (req as any).csrfToken = token;

  next();
}

/**
 * Middleware to validate CSRF token
 * Apply this to all state-changing routes (POST, PUT, DELETE, PATCH)
 *
 * Usage:
 *   app.post('/api/employees', protect, validateCSRFMiddleware, createEmployee)
 */
export function validateCSRFMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip validation for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  // Get token from cookie
  const token = req.cookies?.[CSRF_COOKIE_NAME];

  // Get secret from header
  const secret = req.headers[CSRF_HEADER_NAME] as string;

  if (!token || !secret) {
    logger.warn('CSRF validation failed: missing token or secret', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userId: (req as any).user?.userId,
    });

    res.status(403).json({
      success: false,
      message: 'CSRF token validation failed',
      error: 'MISSING_CSRF_TOKEN',
    });
    return;
  }

  // Validate token
  const isValid = validateCSRFToken(token, secret);

  if (!isValid) {
    logger.warn('CSRF validation failed: invalid token', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userId: (req as any).user?.userId,
    });

    res.status(403).json({
      success: false,
      message: 'CSRF token validation failed',
      error: 'INVALID_CSRF_TOKEN',
    });
    return;
  }

  logger.debug('CSRF validation successful', {
    method: req.method,
    path: req.path,
    userId: (req as any).user?.userId,
  });

  next();
}

/**
 * Middleware factory to conditionally validate CSRF
 * Validates CSRF only for specific methods
 *
 * Usage:
 *   app.use(validateCSRFConditionally(['POST', 'PUT', 'DELETE']))
 */
export function validateCSRFConditionally(methods: string[] = ['POST', 'PUT', 'DELETE', 'PATCH']) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (methods.includes(req.method)) {
      validateCSRFMiddleware(req, res, next);
    } else {
      next();
    }
  };
}

/**
 * Helper function to get CSRF token from request
 * Use this in route handlers to send token to client
 */
export function getCSRFTokenFromRequest(req: Request): string | undefined {
  return (req as any).csrfToken;
}

/**
 * Generate hash for additional validation
 * Can be used for double-submit cookie pattern validation
 */
export function hashToken(token: string, secret: string): string {
  return createHash('sha256')
    .update(`${token}:${secret}`)
    .digest('hex');
}
