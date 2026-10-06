/**
 * JWT Token Management with Refresh Tokens
 *
 * Implements secure token generation and validation with:
 * - Short-lived access tokens (15 minutes)
 * - Long-lived refresh tokens (7 days)
 * - Token rotation on refresh
 * - Revocation support
 */

import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import type { UserRole } from './rbac';

/**
 * Token configuration
 */
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

/**
 * Get JWT secret from environment
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) throw new Error('JWT_SECRET is required for session tokens');

  return secret;
}

/**
 * JWT access token payload
 */
export interface AccessTokenPayload {
  userId: string;
  businessId: string;
  email: string;
  role: UserRole;
  type: 'access';
}

/**
 * JWT refresh token payload
 */
export interface RefreshTokenPayload {
  userId: string;
  businessId: string;
  tokenId: string; // Unique ID for this refresh token
  type: 'refresh';
}

/**
 * Token pair (access + refresh)
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Access token expiration in seconds
}

/**
 * Generate a new access token
 *
 * @param payload - Token payload data
 * @returns JWT access token
 */
export function generateAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
  const secret = getJwtSecret();

  return jwt.sign(
    {
      ...payload,
      type: 'access',
    } as AccessTokenPayload,
    secret,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    }
  );
}

/**
 * Generate a new refresh token
 *
 * @param userId - User ID
 * @param businessId - Business ID
 * @returns JWT refresh token and token ID
 */
export function generateRefreshToken(userId: string, businessId: string): { token: string; tokenId: string } {
  const secret = getJwtSecret();
  const tokenId = randomBytes(32).toString('hex');

  const token = jwt.sign(
    {
      userId,
      businessId,
      tokenId,
      type: 'refresh',
    } as RefreshTokenPayload,
    secret,
    {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    }
  );

  return { token, tokenId };
}

/**
 * Generate both access and refresh tokens
 *
 * @param user - User data
 * @returns Token pair
 */
export function generateTokenPair(user: {
  id: string;
  businessId: string;
  email: string;
  role: UserRole;
}): TokenPair & { refreshTokenId: string } {
  const accessToken = generateAccessToken({
    userId: user.id,
    businessId: user.businessId,
    email: user.email,
    role: user.role,
  });

  const { token: refreshToken, tokenId: refreshTokenId } = generateRefreshToken(
    user.id,
    user.businessId
  );

  return {
    accessToken,
    refreshToken,
    refreshTokenId,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
}

/**
 * Verify and decode an access token
 *
 * @param token - JWT access token
 * @returns Decoded payload
 * @throws Error if token is invalid or expired
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const secret = getJwtSecret();

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as AccessTokenPayload;

    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token');
    }
    throw error;
  }
}

/**
 * Verify and decode a refresh token
 *
 * @param token - JWT refresh token
 * @returns Decoded payload
 * @throws Error if token is invalid or expired
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const secret = getJwtSecret();

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as RefreshTokenPayload;

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}

/**
 * Decode token without verification (for debugging)
 *
 * @param token - JWT token
 * @returns Decoded payload or null
 */
export function decodeToken(token: string): AccessTokenPayload | RefreshTokenPayload | null {
  try {
    return jwt.decode(token) as AccessTokenPayload | RefreshTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Check if a token is expired (without throwing)
 *
 * @param token - JWT token
 * @returns true if expired, false otherwise
 */
export function isTokenExpired(token: string): boolean {
  try {
    const decoded = decodeToken(token);
    if (!decoded || typeof decoded === 'string') return true;

    const exp = (decoded as any).exp;
    if (!exp) return true;

    return Date.now() >= exp * 1000;
  } catch {
    return true;
  }
}

/**
 * Extract token from Authorization header
 *
 * @param authHeader - Authorization header value
 * @returns Token string or null
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7);
}
