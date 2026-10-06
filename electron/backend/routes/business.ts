import { logger } from '../../../lib/infrastructure/Logger';
import { Router } from 'express';
import { managedRouter } from '../middleware/request-lifecycle';
import { getPrismaClient } from '../database';
import { z } from 'zod';
import { protect } from './auth';
import { AuthenticatedRequest, getBusinessId } from '../types/express';
import { businessResponse, encryptedEin } from '../middleware/sensitive-fields';
import { payPolicy } from '../middleware/payroll-policy';

const router = managedRouter();

// Validation schemas
const updateBusinessSchema = z.object({
  name: z.string().min(1, 'Business name is required').optional(),
  type: z.string().optional(),
  phone: z.string().optional(),
  website: z.union([z.literal(''), z.string().url('Must be a valid URL')]).transform(value => value === '' ? null : value).optional(),
  ein: z.string().optional(),
  address: z.string().nullable().optional(),
});

// Note: Using proper JWT auth middleware imported from './auth'

// @route   GET /api/business
// @desc    Get business information
// @access  Private
router.get('/', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    
    const business = await prisma.business.findFirst({
      where: { id: getBusinessId(req) },
      include: {
        businessConfigurations: true,
      },
    });

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    res.json({
      success: true,
      data: businessResponse(business),
    });
  } catch (error) {
    logger.error('Error fetching business:', error);
    res.status(500).json({ message: 'Server error fetching business' });
  }
});

// @route   PUT /api/business
// @desc    Update business information
// @access  Private
router.put('/', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const validatedData = updateBusinessSchema.parse(req.body);
    
    // Find the first business (single-user app has one business)
    const existingBusiness = await prisma.business.findFirst({ where: { id: getBusinessId(req) } });
    
    if (!existingBusiness) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const updatedBusiness = await prisma.business.update({
      where: { id: existingBusiness.id },
      data: {
        ...validatedData,
        ...(validatedData.ein !== undefined ? { ein: encryptedEin(validatedData.ein) } : {}),
        updatedAt: new Date(),
      },
      include: {
        businessConfigurations: true,
      },
    });

    res.json({
      success: true,
      data: businessResponse(updatedBusiness),
      message: 'Business updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.issues,
      });
    }
    
    logger.error('Error updating business:', error);
    res.status(500).json({ message: 'Server error updating business' });
  }
});

// @route   GET /api/business/configuration
// @desc    Get business configuration
// @access  Private
router.get('/configuration', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    
    const business = await prisma.business.findFirst({ where: { id: getBusinessId(req) } });
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const config = await prisma.businessConfiguration.findUnique({
      where: { businessId: business.id },
    });

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error('Error fetching business configuration:', error);
    res.status(500).json({ message: 'Server error fetching configuration' });
  }
});

// @route   PUT /api/business/configuration
// @desc    Update business configuration
// @access  Private
router.put('/configuration', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const {
      timeZone,
      payPeriodStartDay,
      payPeriodFrequency,
      tipPoolingEnabled,
      tipOutMethod,
      defaultTipPercentage,
    } = req.body;
    if ((timeZone !== undefined && (typeof timeZone !== 'string' || !timeZone.trim())) || [payPeriodFrequency, tipOutMethod].some(value => value !== undefined && (typeof value !== 'string' || !value.trim()))) return res.status(400).json({ message: 'Timezone, pay frequency and tip method must be nonempty strings' });
    try { payPolicy({ timeZone, payPeriodStartDay }); } catch { return res.status(400).json({ message: 'Valid business timezone and workweek start day (0-6) required' }); }
    if ((defaultTipPercentage !== undefined && (typeof defaultTipPercentage !== 'number' || !Number.isFinite(defaultTipPercentage) || defaultTipPercentage < 0 || defaultTipPercentage > 100)) || (tipPoolingEnabled !== undefined && typeof tipPoolingEnabled !== 'boolean')) return res.status(400).json({ message: 'Invalid tip configuration' });

    const business = await prisma.business.findFirst({ where: { id: getBusinessId(req) } });
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    const currentConfiguration = await prisma.businessConfiguration.findUnique({ where: { businessId: business.id } });
    const currentPolicy = payPolicy(currentConfiguration);
    const nextPolicy = payPolicy({
      timeZone: timeZone === undefined ? currentConfiguration?.timeZone : timeZone,
      payPeriodStartDay: payPeriodStartDay === undefined ? currentConfiguration?.payPeriodStartDay : payPeriodStartDay,
    });
    const canonicalZone = (zone: string) => new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone;
    const policyChanged = canonicalZone(currentPolicy.timeZone) !== canonicalZone(nextPolicy.timeZone) || currentPolicy.weekStartDay !== nextPolicy.weekStartDay;
    if (policyChanged && await prisma.payrollPeriod.findFirst({ where: { businessId: business.id, status: { in: ['closed', 'paid'] } }, select: { id: true } })) {
      return res.status(409).json({ message: 'Reopen closed payroll periods before changing the business timezone or workweek start; paid periods retain their existing policy' });
    }

    const config = await prisma.businessConfiguration.upsert({
      where: { businessId: business.id },
      update: {
        timeZone: timeZone === undefined ? undefined : nextPolicy.timeZone,
        payPeriodStartDay: payPeriodStartDay === undefined ? undefined : nextPolicy.weekStartDay,
        payPeriodFrequency,
        tipPoolingEnabled,
        tipOutMethod,
        defaultTipPercentage,
        updatedAt: new Date(),
      },
      create: {
        businessId: business.id,
        timeZone: timeZone || 'America/New_York',
        payPeriodStartDay: payPeriodStartDay ?? 1,
        payPeriodFrequency: payPeriodFrequency || 'bi-weekly',
        tipPoolingEnabled: tipPoolingEnabled ?? true,
        tipOutMethod: tipOutMethod || 'percentage',
        defaultTipPercentage: defaultTipPercentage ?? 18.0,
      },
    });

    res.json({
      success: true,
      data: config,
      message: 'Configuration updated successfully',
    });
  } catch (error) {
    logger.error('Error updating configuration:', error);
    res.status(500).json({ message: 'Server error updating configuration' });
  }
});

export default router;
