import { Router, Request, Response, NextFunction } from 'express';
import { managedRouter } from '../middleware/request-lifecycle';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../database';
import { config } from '../../../lib/infrastructure/ConfigurationService';
import { logger } from '../../../lib/infrastructure/Logger';
import {
  LoginRequestSchema,
  SetupRequestSchema,
  ChangePasswordRequestSchema,
  validateRequest,
  type ApiResponse,
  type AuthResponse,
} from '../../../lib/types/api-dtos';
import { AuthenticatedRequest, getUserId } from '../types/express';
import { requireBootstrapToken } from '../middleware/api-security';
import { authRateLimiter, sensitiveRateLimiter } from '../../../lib/security/rate-limit';
import { createHash, randomUUID } from 'node:crypto';
import { encryptedEin } from '../middleware/sensitive-fields';
import { payPolicy } from '../middleware/payroll-policy';

// Re-export AuthenticatedRequest for use in other route files
export type { AuthenticatedRequest } from '../types/express';

const router = managedRouter();
let setupInProgress = false;

// SECURITY FIX: Use ConfigurationService instead of hardcoded fallback
// This throws an error in production if JWT_SECRET is not set
const JWT_SECRET = config.get('jwtSecret');
const credentialVersion = (passwordHash: string) => createHash('sha256').update(passwordHash).digest('hex');
function sessionToken(user: { id: string; businessId: string; passwordHash: string }, remember = false): string {
  return jwt.sign({ userId: user.id, businessId: user.businessId, credentialVersion: credentialVersion(user.passwordHash) }, JWT_SECRET, { expiresIn: remember ? '7d' : '24h', algorithm: 'HS256', jwtid: randomUUID() });
}

// ... (existing routes like /status, /setup, /login remain the same)
// @route   GET /api/auth/status
// @desc    Check if the app is configured
// @access  Public
router.get('/status', async (req, res) => {
  try {
    const prisma = getPrismaClient();
    
    // Check if there are any users
    const userCount = await prisma.user.count();
    const businessCount = await prisma.business.count();
    
    const configured = userCount > 0 && businessCount > 0;
    const requiresSetup = !configured;
    
    res.json({
      success: true,
      configured,
      requiresSetup,
      requiresBootstrapToken: requiresSetup,
    });
  } catch (error) {
    logger.error('Auth status check error', { error });
    res.status(500).json({
      success: false,
      configured: false,
      requiresSetup: true,
      message: 'Database not initialized'
    });
  }
});

// @route   POST /api/auth/setup
// @desc    Initial app setup
// @access  Public
router.post('/setup', authRateLimiter, requireBootstrapToken, async (req, res) => {
  if (setupInProgress) return res.status(409).json({ message: 'Setup is already in progress' });
  setupInProgress = true;
  try {
    // Validate request body with DTO
    const validation = validateRequest(SetupRequestSchema, req.body);

    if (validation.success === false) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    const setupData = validation.data;
    try { payPolicy({ timeZone: setupData.timezone }); } catch { return res.status(400).json({ message: 'Valid business timezone required' }); }
    const prisma = getPrismaClient();
    
    const existingUser = await prisma.user.findFirst();
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Setup has already been completed',
      });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(setupData.password, salt);

    const { business, user } = await prisma.$transaction(async transaction => {
    if (await transaction.user.findFirst()) throw new Error('Setup has already been completed');
    const business = await transaction.business.create({
      data: {
        name: setupData.businessName,
        type: setupData.businessType || 'restaurant',
        ein: encryptedEin(setupData.ein),
        location: setupData.location || null,
        posSystem: setupData.posSystem || null,
        usageIntent: setupData.usageIntent || null,
      },
    });

    const user = await transaction.user.create({
      data: {
        email: setupData.email.toLowerCase(),
        phone: setupData.phone || null,
        firstName: setupData.firstName,
        lastName: setupData.lastName,
        role: 'owner',
        passwordHash,
        preferredPayrollFreq: setupData.preferredPayrollFreq,
        preferredTipStyle: setupData.preferredTipStyle,
        acceptedTerms: setupData.acceptedTerms,
        acceptedPrivacy: setupData.acceptedPrivacy,
        analyticsConsent: setupData.analyticsConsent,
        businessId: business.id,
      },
    });
    
    await transaction.businessConfiguration.create({
      data: {
        businessId: business.id,
        timeZone: setupData.timezone,
      }
    });
    await transaction.appSetting.upsert({
      where: { key: 'first_launch' }, update: { value: 'false' }, create: { key: 'first_launch', value: 'false' },
    });
    return { business, user };
    });
    
    const token = sessionToken(user);

    const response: ApiResponse<AuthResponse> = {
      success: true,
      message: 'Setup completed successfully',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role as 'owner',
          businessId: business.id,
        },
      },
    };

    res.status(201).json({ ...response, ...response.data });
  } catch (error) {
    logger.error('Setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during setup',
    });
  } finally { setupInProgress = false; }
});

// @route   POST /api/auth/login
// @desc    User login with rate limiting and security features
// @access  Public
router.post('/login', authRateLimiter, async (req, res) => {
  try {
    // Validate request body with DTO
    const validation = validateRequest(LoginRequestSchema, req.body);

    if (validation.success === false) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    const { email, password, rememberMe } = validation.data;
    const prisma = getPrismaClient();
    
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { phone: email }
        ]
      },
      include: { business: true }
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const lockTimeRemaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000 / 60);
      return res.status(423).json({ 
        message: `Account temporarily locked. Try again in ${lockTimeRemaining} minute(s).` 
      });
    }
    
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const newFailedAttempts = user.failedLoginAttempts + 1;
      const maxAttempts = 5;
      
      let updateData: Prisma.UserUpdateInput = {
        failedLoginAttempts: newFailedAttempts
      };
      
      if (newFailedAttempts >= maxAttempts) {
        updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        updateData.failedLoginAttempts = 0;
      }
      
      await prisma.user.update({
        where: { id: user.id },
        data: updateData
      });
      
      if (newFailedAttempts >= maxAttempts) {
        return res.status(423).json({ 
          message: 'Too many failed attempts. Account locked for 15 minutes.' 
        });
      }
      
      return res.status(401).json({ 
        message: `Invalid credentials. ${maxAttempts - newFailedAttempts} attempt(s) remaining.` 
      });
    }
    
    const updateData: Prisma.UserUpdateInput = {
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null
    };
    
    if (rememberMe !== undefined) {
      updateData.rememberMe = rememberMe;
    }
    
    await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });
    
    const token = sessionToken(user, rememberMe);
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        businessId: user.businessId,
        lastLoginAt: user.lastLoginAt,
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

/**
 * JWT Payload interface for type safety
 */
interface JWTPayload {
  userId: string;
  businessId: string;
  email: string;
  role: string;
  iat?: number;
  credentialVersion: string;
}

/**
 * Extended Request interface with authenticated user
 */
/**
 * Authentication middleware - protects routes requiring login
 * Verifies JWT token and attaches user to request
 */
export const protect = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JWTPayload;
      if (typeof decoded.userId !== 'string' || !decoded.userId) throw new Error('Invalid token subject');
      const prisma = getPrismaClient();

      const currentUser = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!currentUser) {
        logger.warn('Authentication failed: user not found', { userId: decoded.userId });
        res.status(401).json({ message: 'Not authorized, user not found' });
        return;
      }

      if (!currentUser.passwordHash || decoded.credentialVersion !== credentialVersion(currentUser.passwordHash)) {
        res.status(401).json({ message: 'Session has been revoked. Please log in again.' }); return;
      }
      const revoked = await prisma.appSetting.findUnique({ where: { key: `auth.revoked.v1:${createHash('sha256').update(token!).digest('hex')}` } });
      if (revoked) { res.status(401).json({ message: 'Session has been revoked' }); return; }

      // Attach user to request
      req.user = {
        id: currentUser.id,
        userId: currentUser.id,
        email: currentUser.email,
        role: currentUser.role,
        businessId: currentUser.businessId,
      };

      logger.debug('User authenticated successfully', {
        userId: currentUser.id,
        email: currentUser.email,
      });

      next();
      return;
    } catch (error) {
      logger.error('Authentication error', { error });

      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({ message: 'Token expired, please log in again' });
        return;
      }

      res.status(401).json({ message: 'Not authorized, token failed' });
      return;
    }
  }

  if (!token) {
    logger.warn('Authentication failed: no token provided');
    res.status(401).json({ message: 'Not authorized, no token provided' });
    return;
  }
};

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const currentUser = await getPrismaClient().user.findUnique({
      where: { id: getUserId(req) },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, businessId: true, lastLoginAt: true },
    });
    if (!currentUser) return res.status(404).json({ message: 'User not found' });
    const { id, email, firstName, lastName, role, businessId, lastLoginAt } = currentUser;
    res.json({ success: true, user: { id, email, firstName, lastName, role, businessId, lastLoginAt } });
  } catch (error) {
    logger.error('Failed to load authenticated user', { error });
    res.status(500).json({ message: 'Unable to load current user' });
  }
});

router.post('/logout', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const token = req.headers.authorization!.split(' ')[1];
    const key = `auth.revoked.v1:${createHash('sha256').update(token).digest('hex')}`;
    const payload = jwt.decode(token) as { exp: number };
    await getPrismaClient().appSetting.upsert({ where: { key }, update: { value: String(payload.exp) }, create: { key, value: String(payload.exp) } });
    res.json({ success: true });
  } catch { res.status(500).json({ message: 'Could not revoke session' }); }
});


// @route   PUT /api/auth/password
// @desc    Change password
// @access  Private
router.put('/password', protect, sensitiveRateLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const validation = validateRequest(ChangePasswordRequestSchema, req.body);
    if (validation.success === false) return res.status(400).json({ success: false, errors: validation.errors });
    const { currentPassword, newPassword } = validation.data;
    
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash }
    });
    
    res.json({
      success: true,
      message: 'Password updated successfully',
      requiresLogin: true,
    });
  } catch (error) {
    logger.error('Password change error:', error);
    res.status(500).json({ message: 'Server error changing password' });
  }
});

export default router;
