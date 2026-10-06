/**
 * Security Headers Configuration
 *
 * Configures HTTP security headers using Helmet middleware.
 * Protects against common web vulnerabilities.
 */

import helmet from 'helmet';
import type { HelmetOptions } from 'helmet';

/**
 * Production security headers configuration
 * Strict settings for production environments
 */
export const productionHeadersConfig: HelmetOptions = {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for UI libraries
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },

  // HTTP Strict Transport Security (HSTS)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },

  // X-Frame-Options: Prevent clickjacking
  frameguard: {
    action: 'deny',
  },

  // X-Content-Type-Options: Prevent MIME type sniffing
  noSniff: true,

  // X-XSS-Protection: Enable XSS filter
  xssFilter: true,

  // Referrer-Policy: Control referrer information
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },

  // X-Permitted-Cross-Domain-Policies
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none',
  },

  // X-DNS-Prefetch-Control
  dnsPrefetchControl: {
    allow: false,
  },

  // X-Download-Options
  ieNoOpen: true,

  // Hide X-Powered-By header
  hidePoweredBy: true,
};

/**
 * Development security headers configuration
 * Slightly relaxed for development workflow
 */
export const developmentHeadersConfig: HelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow eval for dev tools
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:', 'http:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:'], // Allow WebSocket for hot reload
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },

  hsts: false, // Disable HSTS in development (no HTTPS)

  frameguard: {
    action: 'sameorigin', // Allow framing from same origin
  },

  noSniff: true,
  xssFilter: true,

  referrerPolicy: {
    policy: 'no-referrer-when-downgrade',
  },

  hidePoweredBy: true,
};

/**
 * Get Helmet configuration based on environment
 */
export function getHelmetConfig(): HelmetOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? productionHeadersConfig : developmentHeadersConfig;
}

/**
 * Create Helmet middleware with appropriate configuration
 */
export function createSecurityHeaders() {
  return helmet(getHelmetConfig());
}

/**
 * CORS configuration
 */
export interface CorsConfig {
  origin: string | string[] | boolean;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  maxAge: number;
}

/**
 * Production CORS configuration
 */
export const productionCorsConfig: CorsConfig = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || false,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  maxAge: 86400, // 24 hours
};

/**
 * Development CORS configuration
 */
export const developmentCorsConfig: CorsConfig = {
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  maxAge: 86400,
};

/**
 * Get CORS configuration based on environment
 */
export function getCorsConfig(): CorsConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? productionCorsConfig : developmentCorsConfig;
}

/**
 * Additional custom security headers
 */
export const customSecurityHeaders = {
  /**
   * Feature-Policy / Permissions-Policy
   * Control browser features
   */
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',

  /**
   * Expect-CT
   * Certificate Transparency
   */
  'Expect-CT': 'max-age=86400, enforce',

  /**
   * X-Content-Type-Options
   * Additional MIME type protection
   */
  'X-Content-Type-Options': 'nosniff',
};

/**
 * Middleware to add custom security headers
 */
export function addCustomSecurityHeaders(req: any, res: any, next: any) {
  Object.entries(customSecurityHeaders).forEach(([header, value]) => {
    res.setHeader(header, value);
  });
  next();
}
