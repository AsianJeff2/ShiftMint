/**
 * Rate Limiting Configuration
 *
 * Implements configurable rate limits to prevent abuse and brute force attacks.
 * Uses express-rate-limit with different limits for different endpoints.
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';

/**
 * Rate limit options interface
 */
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

/**
 * Default rate limit configurations
 */
const rateLimitConfigs = {
  /**
   * Strict rate limit for authentication endpoints
   * - 5 requests per 15 minutes
   * - Prevents brute force attacks
   */
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many login attempts. Please try again in 15 minutes.',
    skipSuccessfulRequests: true,
    skipFailedRequests: false,
  },

  /**
   * Standard API rate limit
   * - 100 requests per minute
   * - Prevents API abuse
   */
  api: {
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: 'Too many requests. Please try again later.',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },

  /**
   * Strict rate limit for sensitive operations
   * - 10 requests per hour
   * - For operations like password changes, bulk operations
   */
  sensitive: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: 'Too many requests for this sensitive operation. Please try again later.',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },

  /**
   * Lenient rate limit for read-only operations
   * - 300 requests per minute
   * - For GET requests that don't modify data
   */
  readOnly: {
    windowMs: 60 * 1000, // 1 minute
    max: 300,
    message: 'Too many requests. Please slow down.',
    skipSuccessfulRequests: true,
    skipFailedRequests: false,
  },
};

/**
 * Key generator for rate limiting
 * Uses IP address and user ID (if authenticated)
 */
function generateKey(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userId = (req as any).user?.userId || 'anonymous';
  return `${ipKeyGenerator(ip)}:${userId}`;
}

/**
 * Custom handler for rate limit exceeded
 */
function rateLimitHandler(req: Request, res: Response) {
  const ip = req.ip || req.socket.remoteAddress;
  console.warn(`Rate limit exceeded for IP: ${ip}, path: ${req.path}`);

  res.status(429).json({
    success: false,
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: res.getHeader('Retry-After'),
  });
}

/**
 * Create a rate limiter with custom config
 */
export function createRateLimiter(config: RateLimitConfig) {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    skipSuccessfulRequests: config.skipSuccessfulRequests,
    skipFailedRequests: config.skipFailedRequests,
    keyGenerator: config.keyGenerator || generateKey,
    skip: config.skip,
    handler: rateLimitHandler,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
  });
}

/**
 * Authentication rate limiter
 * - 5 requests per 15 minutes
 * - Use on /api/auth/login, /api/auth/setup
 */
export const authRateLimiter = createRateLimiter({ ...rateLimitConfigs.auth, keyGenerator: req => {
  const identifier = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'missing-identifier';
  return `${ipKeyGenerator(req.ip || req.socket.remoteAddress || 'unknown')}:${createHash('sha256').update(identifier).digest('hex')}`;
} });

/**
 * General API rate limiter
 * - 100 requests per minute
 * - Use on all /api/* routes
 */
export const apiRateLimiter = createRateLimiter({ ...rateLimitConfigs.api, skip: req => process.env.SHIFTMINT_RUNTIME === 'desktop' && Boolean((req as Request & { user?: unknown }).user) });

/**
 * Sensitive operations rate limiter
 * - 10 requests per hour
 * - Use on password changes, bulk operations, deletions
 */
export const sensitiveRateLimiter = createRateLimiter(rateLimitConfigs.sensitive);

/**
 * Read-only operations rate limiter
 * - 300 requests per minute
 * - Use on GET endpoints
 */
export const readOnlyRateLimiter = createRateLimiter(rateLimitConfigs.readOnly);

/**
 * Custom rate limiter factory
 * Create a rate limiter with specific limits
 *
 * @param windowMinutes - Time window in minutes
 * @param maxRequests - Maximum requests in window
 * @param message - Custom error message
 */
export function customRateLimiter(
  windowMinutes: number,
  maxRequests: number,
  message?: string
) {
  return createRateLimiter({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: message || 'Rate limit exceeded',
  });
}

/**
 * Get rate limit info from headers
 * Useful for displaying to users
 */
export function getRateLimitInfo(res: Response) {
  return {
    limit: res.getHeader('RateLimit-Limit'),
    remaining: res.getHeader('RateLimit-Remaining'),
    reset: res.getHeader('RateLimit-Reset'),
  };
}
