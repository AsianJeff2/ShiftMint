/**
 * Session Management
 *
 * Manages refresh tokens, device tracking, and session lifecycle
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../infrastructure/Logger';

export interface SessionInfo {
  id: string;
  tokenId: string;
  deviceInfo?: string;
  ipAddress?: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

/**
 * Session Manager
 */
export class SessionManager {
  constructor(private prisma: PrismaClient) {}

  /**
   * Store a refresh token in the database
   *
   * @param tokenId - Unique token identifier
   * @param userId - User ID
   * @param businessId - Business ID
   * @param expiresAt - Expiration timestamp
   * @param deviceInfo - User agent string
   * @param ipAddress - Client IP address
   */
  async storeRefreshToken(
    tokenId: string,
    userId: string,
    businessId: string,
    expiresAt: Date,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      await this.prisma.refreshToken.create({
        data: {
          tokenId,
          userId,
          businessId,
          expiresAt,
          deviceInfo,
          ipAddress,
          lastUsedAt: new Date(),
        },
      });

      logger.info('Refresh token stored', { userId, tokenId });
    } catch (error) {
      logger.error('Failed to store refresh token', { error, userId, tokenId });
      throw new Error('Failed to store refresh token');
    }
  }

  /**
   * Validate a refresh token
   *
   * @param tokenId - Token identifier
   * @returns true if valid, false otherwise
   */
  async validateRefreshToken(tokenId: string): Promise<boolean> {
    try {
      const token = await this.prisma.refreshToken.findUnique({
        where: { tokenId },
      });

      if (!token) {
        logger.warn('Refresh token not found', { tokenId });
        return false;
      }

      if (token.isRevoked) {
        logger.warn('Refresh token revoked', { tokenId });
        return false;
      }

      if (token.expiresAt < new Date()) {
        logger.warn('Refresh token expired', { tokenId });
        return false;
      }

      // Update last used timestamp
      await this.prisma.refreshToken.update({
        where: { tokenId },
        data: { lastUsedAt: new Date() },
      });

      return true;
    } catch (error) {
      logger.error('Error validating refresh token', { error, tokenId });
      return false;
    }
  }

  /**
   * Revoke a specific refresh token
   *
   * @param tokenId - Token identifier
   */
  async revokeRefreshToken(tokenId: string): Promise<void> {
    try {
      await this.prisma.refreshToken.update({
        where: { tokenId },
        data: { isRevoked: true },
      });

      logger.info('Refresh token revoked', { tokenId });
    } catch (error) {
      logger.error('Failed to revoke refresh token', { error, tokenId });
    }
  }

  /**
   * Revoke all refresh tokens for a user
   * Useful for "logout everywhere" functionality
   *
   * @param userId - User ID
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      const result = await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          isRevoked: false,
        },
        data: {
          isRevoked: true,
        },
      });

      logger.info('All user tokens revoked', { userId, count: result.count });
    } catch (error) {
      logger.error('Failed to revoke all user tokens', { error, userId });
      throw new Error('Failed to revoke all tokens');
    }
  }

  /**
   * Get all active sessions for a user
   *
   * @param userId - User ID
   * @returns Array of active sessions
   */
  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    try {
      const tokens = await this.prisma.refreshToken.findMany({
        where: {
          userId,
          isRevoked: false,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          lastUsedAt: 'desc',
        },
      });

      return tokens.map(token => ({
        id: token.id,
        tokenId: token.tokenId,
        deviceInfo: token.deviceInfo || undefined,
        ipAddress: token.ipAddress || undefined,
        createdAt: token.createdAt,
        lastUsedAt: token.lastUsedAt,
        expiresAt: token.expiresAt,
        isActive: token.lastUsedAt > new Date(Date.now() - 24 * 60 * 60 * 1000), // Active in last 24h
      }));
    } catch (error) {
      logger.error('Failed to get user sessions', { error, userId });
      return [];
    }
  }

  /**
   * Clean up expired tokens
   * Should be run periodically (e.g., daily cron job)
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            {
              expiresAt: {
                lt: new Date(),
              },
            },
            {
              isRevoked: true,
              createdAt: {
                lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Older than 30 days
              },
            },
          ],
        },
      });

      logger.info('Expired tokens cleaned up', { count: result.count });
      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup expired tokens', { error });
      return 0;
    }
  }

  /**
   * Get refresh token details
   *
   * @param tokenId - Token identifier
   * @returns Refresh token data or null
   */
  async getRefreshToken(tokenId: string) {
    try {
      return await this.prisma.refreshToken.findUnique({
        where: { tokenId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              businessId: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get refresh token', { error, tokenId });
      return null;
    }
  }
}

/**
 * Create a session manager instance
 */
export function createSessionManager(prisma: PrismaClient): SessionManager {
  return new SessionManager(prisma);
}
