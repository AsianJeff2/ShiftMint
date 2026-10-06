import { logger } from '../../../lib/infrastructure/Logger';
import { Router } from 'express';
import { managedRouter } from '../middleware/request-lifecycle';
import { getPrismaClient } from '../database';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import type { TipEntry, Shift, Employee } from '@prisma/client';
import { protect } from './auth';
import { payrollDateLocked } from '../middleware/locked-period';
import { groupTipsByBusinessDay } from '../middleware/tip-summary';
import {
  CreateTipRequestSchema,
  UpdateTipRequestSchema,
  TipTypeSchema,
  OffsetTimestampSchema,
  validateRequest,
  type ApiResponse,
} from '../../../lib/types/api-dtos';
import { AuthenticatedRequest, IdParamRequest, getBusinessId, getUserId } from '../types/express';
import { queryRange, pageInteger, RequestRangeError } from '../middleware/query-range';
import { payPolicy } from '../middleware/payroll-policy';

const router = managedRouter();
async function linkedShiftProblem(businessId: string, shiftId: string | null | undefined, employeeId: string | null | undefined) {
  if (!shiftId) return null;
  const shift = await getPrismaClient().shift.findFirst({ where: { id: shiftId, businessId } });
  if (!shift) return { status: 404, message: 'Shift not found' };
  if (shift.employeeId && shift.employeeId !== employeeId) return { status: 400, message: 'Tip employee must match the employee assigned to the linked shift' };
  return null;
}

// @route   GET /api/tips
// @desc    Get all tips for the user
// @access  Private
router.get('/', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const { startDate, endDate } = req.query;
    const limit = pageInteger(req.query.limit, 50, 500);
    const offset = pageInteger(req.query.offset, 0, 1000000);
    if (!limit) return res.status(400).json({ message: 'Limit must be positive' });
    const policy = payPolicy(await prisma.businessConfiguration.findUnique({ where: { businessId: getBusinessId(req) } }));
    const range = queryRange(startDate, endDate, policy.timeZone);
    
    // Filter by user's business ID for security
    const where: Prisma.TipEntryWhereInput = {
      businessId: getBusinessId(req),
      complianceStatus: { not: 'voided' },
    };
    
    if (range.start || range.endExclusive) where.timestamp = { ...(range.start ? { gte: range.start } : {}), ...(range.endExclusive ? { lt: range.endExclusive } : {}) };

    const [tips, total] = await Promise.all([
      prisma.tipEntry.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.tipEntry.count({ where }),
    ]);

    res.json({
      success: true,
      tips,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + tips.length < total,
      },
    });
  } catch (error) {
    if (error instanceof RequestRangeError) return res.status(400).json({ message: error.message });
    logger.error('Error fetching tips:', error);
    res.status(500).json({ message: 'Server error fetching tips' });
  }
});

// @route   POST /api/tips
// @desc    Create a new tip entry
// @access  Private
router.post('/', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();

    // Validate request body with shared DTO
    const validation = validateRequest(CreateTipRequestSchema, req.body);

    if (validation.success === false) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    const validatedData = validation.data;

    // Get the business ID from authenticated user
    const businessId = getBusinessId(req);
    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'Business ID not found in token'
      });
    }
    
    const timestamp = validatedData.timestamp ? new Date(validatedData.timestamp) : new Date();
    if (!Number.isFinite(timestamp.getTime())) return res.status(400).json({ message: 'Valid tip timestamp required' });
    if (await payrollDateLocked(businessId, [timestamp])) return res.status(409).json({ message: 'Reopen the payroll period before modifying its source tips' });
    if (validatedData.employeeId && !await prisma.employee.findFirst({ where: { id: validatedData.employeeId, businessId } })) return res.status(404).json({ message: 'Employee not found' });
    const relationship = await linkedShiftProblem(businessId, validatedData.shiftId, validatedData.employeeId);
    if (relationship) return res.status(relationship.status).json({ message: relationship.message });
    // Enhanced tip creation with all new fields
    const tip = await prisma.$transaction(async transaction => {
    const createdTip = await transaction.tipEntry.create({
      data: {
        businessId: businessId,
        employeeId: validatedData.employeeId || null,
        shiftId: validatedData.shiftId || null,
        amount: validatedData.amount,
        tipType: validatedData.tipType,
        source: validatedData.source || 'manual',
        notes: validatedData.notes,
        tableNumber: validatedData.tableNumber,
        serverName: validatedData.serverName,
        posTransactionId: validatedData.posTransactionId,
        isPooled: validatedData.isPooled || false,
        taxableAmount: validatedData.taxableAmount ?? validatedData.amount,
        timestamp,
        changeReason: validatedData.changeReason,
        lastModifiedBy: getUserId(req),
        originalAmount: validatedData.amount, // For audit trail
      },
    });

    // Create audit log entry
    await transaction.tipAuditLog.create({
      data: {
        tipEntryId: createdTip.id,
        businessId: businessId,
        action: 'create',
        newValue: JSON.stringify(validatedData),
        reason: validatedData.changeReason || 'Initial tip entry',
        performedBy: getUserId(req),
      },
    });
    return createdTip;
    });

    res.status(201).json({
      success: true,
      data: tip,
      message: 'Tip created successfully',
    });
  } catch (error) {
    logger.error('Error creating tip:', error);
    res.status(500).json({ message: 'Server error creating tip' });
  }
});

// @route   PUT /api/tips/:id
// @desc    Update a tip entry
// @access  Private
router.put('/:id', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const tipId = req.params.id;

    // Validate request body with shared DTO
    const validation = validateRequest(UpdateTipRequestSchema, req.body);

    if (validation.success === false) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    const validatedData = validation.data;

    // Check if tip exists
    const existingTip = await prisma.tipEntry.findFirst({
      where: { id: tipId, businessId: getBusinessId(req) },
    });

    if (!existingTip) {
      return res.status(404).json({
        success: false,
        message: 'Tip not found'
      });
    }

    if (await payrollDateLocked(getBusinessId(req), [existingTip.timestamp])) return res.status(409).json({ message: 'Reopen the payroll period before modifying its source tips' });
    const timestamp = validatedData.timestamp ? new Date(validatedData.timestamp) : existingTip.timestamp;
    if (!Number.isFinite(timestamp.getTime())) return res.status(400).json({ message: 'Valid tip timestamp required' });
    if (await payrollDateLocked(getBusinessId(req), [timestamp])) return res.status(409).json({ message: 'Reopen the target payroll period before moving tips into it' });
    if (validatedData.employeeId && !await prisma.employee.findFirst({ where: { id: validatedData.employeeId, businessId: getBusinessId(req) } })) return res.status(404).json({ message: 'Employee not found' });
    const relationship = await linkedShiftProblem(getBusinessId(req), validatedData.shiftId === undefined ? existingTip.shiftId : validatedData.shiftId || null, validatedData.employeeId === undefined ? existingTip.employeeId : validatedData.employeeId || null);
    if (relationship) return res.status(relationship.status).json({ message: relationship.message });
    if (existingTip.complianceStatus === 'voided') return res.status(409).json({ message: 'A voided tip cannot be changed' });
    const updatedTip = await prisma.$transaction(async transaction => {
    const updated = await transaction.tipEntry.update({
      where: { id: tipId },
      data: {
        ...(validatedData.amount !== undefined && { amount: validatedData.amount, taxableAmount: validatedData.taxableAmount ?? validatedData.amount }),
        ...(validatedData.tipType && { tipType: validatedData.tipType }),
        ...(validatedData.source && { source: validatedData.source }),
        ...(validatedData.notes !== undefined && { notes: validatedData.notes }),
        ...(validatedData.tableNumber !== undefined && { tableNumber: validatedData.tableNumber }),
        ...(validatedData.employeeId !== undefined && { employeeId: validatedData.employeeId || null }),
        ...(validatedData.shiftId !== undefined && { shiftId: validatedData.shiftId || null }),
        ...(validatedData.serverName !== undefined && { serverName: validatedData.serverName }),
        ...(validatedData.taxableAmount !== undefined && { taxableAmount: validatedData.taxableAmount }),
        timestamp,
        updatedAt: new Date(),
        version: { increment: 1 },
        lastModifiedBy: getUserId(req),
        changeReason: validatedData.changeReason || 'Manual correction',
      },
    });
    await transaction.tipAuditLog.create({ data: { tipEntryId: tipId, businessId: getBusinessId(req), action: 'update', oldValue: JSON.stringify(existingTip), newValue: JSON.stringify(updated), reason: validatedData.changeReason || 'Manual correction', performedBy: getUserId(req) } });
    return updated;
    });

    res.json({
      success: true,
      data: updatedTip,
      message: 'Tip updated successfully',
    });
  } catch (error) {
    logger.error('Error updating tip:', error);
    res.status(500).json({ message: 'Server error updating tip' });
  }
});

// @route   DELETE /api/tips/:id
// @desc    Delete a tip entry
// @access  Private
router.delete('/:id', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const tipId = req.params.id;
    
    // Check if tip exists
    const existingTip = await prisma.tipEntry.findFirst({
      where: { id: tipId, businessId: getBusinessId(req) },
    });

    if (!existingTip) {
      return res.status(404).json({ message: 'Tip not found' });
    }

    if (await payrollDateLocked(getBusinessId(req), [existingTip.timestamp])) return res.status(409).json({ message: 'Reopen the payroll period before voiding its source tips' });
    await prisma.$transaction(async transaction => {
      await transaction.tipEntry.update({ where: { id: tipId }, data: { amount: 0, taxableAmount: 0, complianceStatus: 'voided', version: { increment: 1 }, lastModifiedBy: getUserId(req), changeReason: 'Voided by user' } });
      await transaction.tipAuditLog.create({ data: { tipEntryId: tipId, businessId: getBusinessId(req), action: 'delete', oldValue: JSON.stringify(existingTip), reason: 'Voided by user', performedBy: getUserId(req) } });
    });

    res.json({
      success: true,
      message: 'Tip deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting tip:', error);
    res.status(500).json({ message: 'Server error deleting tip' });
  }
});

// @route   GET /api/tips/summary
// @desc    Get tips summary/statistics
// @access  Private
router.get('/summary', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const { period = '7d' } = req.query;
    
    let dateFilter: Date | undefined;
    const now = new Date();
    
    switch (period) {
      case '24h':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const where = { businessId: getBusinessId(req), complianceStatus: { not: 'voided' }, ...(dateFilter ? { timestamp: { gte: dateFilter } } : {}) };
    const configuration = await prisma.businessConfiguration.findUnique({ where: { businessId: getBusinessId(req) } });

    const [
      totalTips,
      totalAmount,
      avgAmount,
      cashTips,
      creditTips,
      dailyTips,
    ] = await Promise.all([
      prisma.tipEntry.count({ where }),
      prisma.tipEntry.aggregate({
        where,
        _sum: { amount: true },
      }),
      prisma.tipEntry.aggregate({
        where,
        _avg: { amount: true },
      }),
      prisma.tipEntry.aggregate({
        where: { ...where, tipType: 'cash' },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.tipEntry.aggregate({
        where: { ...where, tipType: 'credit' },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.tipEntry.findMany({ where, select: { timestamp: true, amount: true } }),
    ]);

    res.json({
      success: true,
      summary: {
        period,
        totalTips,
        totalAmount: totalAmount._sum.amount || 0,
        avgAmount: avgAmount._avg.amount || 0,
        cashTips: {
          count: cashTips._count || 0,
          amount: (cashTips._sum?.amount) || 0,
        },
        creditTips: {
          count: creditTips._count || 0,
          amount: (creditTips._sum?.amount) || 0,
        },
        dailyBreakdown: groupTipsByBusinessDay(dailyTips, configuration?.timeZone || 'America/New_York'),
      },
    });
  } catch (error) {
    logger.error('Error fetching tips summary:', error);
    res.status(500).json({ message: 'Server error fetching tips summary' });
  }
});

// @route   POST /api/tips/bulk
// @desc    Bulk create multiple tip entries
// @access  Private
router.post('/bulk', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const { tips } = req.body;
    
    if (!Array.isArray(tips) || tips.length === 0 || tips.length > 5000) {
      return res.status(400).json({ message: 'Tips array is required and cannot be empty' });
    }

    const businessId = getBusinessId(req);
    const results = [];
    const errors = [];

    for (let i = 0; i < tips.length; i++) {
      try {
        const validation = validateRequest(CreateTipRequestSchema, tips[i]);

        if (validation.success === false) {
          errors.push({ index: i, errors: validation.errors });
          continue;
        }

        const validatedData = validation.data;
        const timestamp = validatedData.timestamp ? new Date(validatedData.timestamp) : new Date();
        if (!Number.isFinite(timestamp.getTime())) throw new Error('Valid timestamp required');
        if (await payrollDateLocked(businessId, [timestamp])) throw new Error('Payroll period is closed');
        if (validatedData.employeeId && !await prisma.employee.findFirst({ where: { id: validatedData.employeeId, businessId } })) throw new Error('Employee not found');
        const relationship = await linkedShiftProblem(businessId, validatedData.shiftId, validatedData.employeeId);
        if (relationship) throw new Error(relationship.message);
        
        const tip = await prisma.$transaction(async transaction => {
        const createdTip = await transaction.tipEntry.create({
          data: {
            businessId: businessId,
            employeeId: validatedData.employeeId || null,
            shiftId: validatedData.shiftId || null,
            amount: validatedData.amount,
            tipType: validatedData.tipType,
            source: 'bulk_entry',
            notes: validatedData.notes,
            tableNumber: validatedData.tableNumber,
            serverName: validatedData.serverName,
            isPooled: validatedData.isPooled || false,
            taxableAmount: validatedData.taxableAmount ?? validatedData.amount,
            timestamp,
            lastModifiedBy: getUserId(req),
            originalAmount: validatedData.amount,
          },
        });

        // Create audit log
        await transaction.tipAuditLog.create({
          data: {
            tipEntryId: createdTip.id,
            businessId: businessId,
            action: 'create',
            newValue: JSON.stringify(validatedData),
            reason: 'Bulk import',
            performedBy: getUserId(req),
          },
        });
        return createdTip;
        });

        results.push(tip);
      } catch (error) {
        errors.push({ index: i, error: error.message });
      }
    }

    res.json({
      success: true,
      data: {
        successful: results.length,
        failed: errors.length,
        results,
        errors,
      },
      message: `Bulk import completed: ${results.length} successful, ${errors.length} failed`,
    });
  } catch (error) {
    logger.error('Error in bulk tip import:', error);
    res.status(500).json({ message: 'Server error in bulk tip import' });
  }
});

// @route   POST /api/tips/validate-shift
// @desc    Validate if shift exists for tip entry, create if needed
// @access  Private  
router.post('/validate-shift', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const { employeeId, date, createIfMissing = false } = req.body;
    if (typeof employeeId !== 'string' || !employeeId.trim()) return res.status(400).json({ message: 'Select an employee before validating a shift' });
    
    const businessId = getBusinessId(req);
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(new Date(date).getTime())) return res.status(400).json({ message: 'Valid date required' });
    if (!await prisma.employee.findFirst({ where: { id: employeeId, businessId } })) return res.status(404).json({ message: 'Employee not found' });
    
    // Check if shift exists for the date
    const existingShift = await prisma.shift.findFirst({
      where: {
        businessId,
        employeeId,
        shiftDate: date,
      },
    });

    if (existingShift) {
      return res.json({
        success: true,
        shiftExists: true,
        shift: existingShift,
      });
    }

    if (createIfMissing) {
      return res.status(422).json({ message: 'Create a shift with its actual timestamps before attaching tips' });
    }

    res.json({
      success: true,
      shiftExists: false,
      message: 'No shift found for this date. Would you like to create one?',
    });
  } catch (error) {
    logger.error('Error validating shift:', error);
    res.status(500).json({ message: 'Server error validating shift' });
  }
});

// @route   GET /api/tips/compliance/:employeeId/:period
// @desc    Calculate compliance for employee in pay period
// @access  Private
router.get('/compliance/:employeeId/:period', protect, (_req, res) => {
  res.status(422).json({ success: false, message: 'Tip wage compliance requires a configured jurisdiction policy and payroll provider review. Automated compliance assertions have been removed.' });
});

// @route   GET /api/tips/analytics/dashboard
// @desc    Get tip analytics for dashboard
// @access  Private
router.get('/analytics/dashboard', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const businessId = getBusinessId(req);
    const configuration = await prisma.businessConfiguration.findUnique({ where: { businessId } });
    const policy = payPolicy(configuration);
    const range = queryRange(req.query.startDate, req.query.endDate, policy.timeZone);
    const dateFilter = { ...(range.start ? { gte: range.start } : {}), ...(range.endExclusive ? { lt: range.endExclusive } : {}) };

    const where = {
      businessId,
      complianceStatus: { not: 'voided' },
      ...(Object.keys(dateFilter).length > 0 && { timestamp: dateFilter }),
    };

    // Aggregate queries
    const [
      totalStats,
      tipsByType,
      tipsBySource,
      dailyTrends,
      topServers,
      employeeGroups,
    ] = await Promise.all([
      // Total statistics
      prisma.tipEntry.aggregate({
        where,
        _sum: { amount: true },
        _avg: { amount: true },
        _count: true,
      }),
      
      // Tips by type
      prisma.tipEntry.groupBy({
        by: ['tipType'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
      
      // Tips by source
      prisma.tipEntry.groupBy({
        by: ['source'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
      
      prisma.tipEntry.findMany({ where, select: { timestamp: true, amount: true } }),
      
      // Top servers by tips
      prisma.tipEntry.groupBy({
        by: ['serverName'],
        where: { ...where, serverName: { not: null } },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      }),
      prisma.tipEntry.groupBy({ by: ['employeeId'], where: { ...where, employeeId: { not: null } }, _sum: { amount: true } }),
    ]);

    res.json({
      success: true,
      data: {
        totalStats: {
          totalAmount: totalStats._sum.amount || 0,
          averageAmount: totalStats._avg.amount || 0,
          totalCount: totalStats._count,
        },
        tipsByType,
        tipsBySource,
        dailyTrends: groupTipsByBusinessDay(dailyTrends, policy.timeZone).map(group => ({ ...group, average: group.count ? group.total / group.count : 0 })),
        topServers,
        tipsByEmployee: employeeGroups.map(group => ({ employeeId: group.employeeId, totalTips: group._sum.amount || 0 })),
      },
    });
  } catch (error) {
    if (error instanceof RequestRangeError) return res.status(400).json({ message: error.message });
    logger.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Server error fetching analytics' });
  }
});

// @route   GET /api/tips/:id/audit
// @desc    Get audit history for a tip entry
// @access  Private
router.get('/:id/audit', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const { id } = req.params;
    const businessId = getBusinessId(req);

    const auditHistory = await prisma.tipAuditLog.findMany({
      where: {
        tipEntryId: id,
        businessId,
      },
      orderBy: { performedAt: 'desc' },
    });

    res.json({
      success: true,
      data: auditHistory,
    });
  } catch (error) {
    logger.error('Error fetching audit history:', error);
    res.status(500).json({ message: 'Server error fetching audit history' });
  }
});

// CSV Import validation schema
const csvTipSchema = z.object({
  employeeName: z.string().optional(),
  amount: z.union([z.string(), z.number()]).transform(val => typeof val === 'number' ? val : Number(val.replace(/[$,]/g, ''))).pipe(z.number().positive()),
  tipType: TipTypeSchema.default('credit'),
  tableNumber: z.string().optional(),
  serverName: z.string().optional(),
  timestamp: OffsetTimestampSchema.transform(val => new Date(val)),
  notes: z.string().optional(),
});

// @route   POST /api/tips/import-csv
// @desc    Import tips from CSV data
// @access  Private
router.post('/import-csv', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const { csvData } = req.body;
    
    if (!csvData || !Array.isArray(csvData) || csvData.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid CSV data format'
      });
    }
    
    const businessId = getBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: 'Business ID not found in token' });
    }
    
    // Get all employees for name matching
    const employees = await prisma.employee.findMany({
      where: { businessId },
      select: { id: true, firstName: true, lastName: true }
    });
    
    const importedTips = [];
    const errors = [];
    
    for (let index = 0; index < csvData.length; index++) {
      const row = csvData[index];
      
      try {
        const validatedRow = csvTipSchema.parse(row);
        if (await payrollDateLocked(businessId, [validatedRow.timestamp])) throw new Error('Payroll period is closed; reopen it before importing source tips');
        
        // Find employee by name if provided
        let employeeId = null;
        const employeeName = (validatedRow.employeeName || validatedRow.serverName)?.trim();
        if (employeeName) {
          const matches = employees.filter((emp: Employee) => {
            const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
            return fullName === employeeName.toLowerCase();
          });
          if (matches.length !== 1) throw new Error('Assign the tip to one existing employee using a unique full name');
          employeeId = matches[0].id;
        }
        
        // Create tip entry
        const tip = await prisma.$transaction(async transaction => {
        const created = await transaction.tipEntry.create({
          data: {
            businessId,
            employeeId,
            amount: validatedRow.amount,
            taxableAmount: validatedRow.amount,
            tipType: validatedRow.tipType,
            source: 'csv_import',
            tableNumber: validatedRow.tableNumber,
            serverName: validatedRow.serverName || validatedRow.employeeName,
            notes: validatedRow.notes,
            timestamp: validatedRow.timestamp,
            processed: false,
            complianceStatus: 'pending',
            wageCreditUsed: 0,
            irsReportable: false,
            version: 1,
          },
        });
        await transaction.tipAuditLog.create({ data: { tipEntryId: created.id, businessId, action: 'create', newValue: JSON.stringify(created), reason: 'CSV import', performedBy: getUserId(req) } });
        return created;
        });
        
        importedTips.push(tip);
        
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          errors.push(`Row ${index + 1}: ${validationError.issues.map(i => i.message).join(', ')}`);
        } else {
          errors.push(`Row ${index + 1}: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`);
        }
      }
    }
    
    // Trigger integration updates after successful import
    if (importedTips.length > 0) {
      logger.info(`CSV Import: Successfully imported ${importedTips.length} tips. Checking for automatic integrations...`);
      
      // Update shift tip totals for imported tips that have associated shifts
      const tipsWithShifts = importedTips.filter(tip => tip.shiftId);
      if (tipsWithShifts.length > 0) {
        for (const tip of tipsWithShifts) {
          await prisma.shift.update({
            where: { id: tip.shiftId! },
            data: {
              totalTips: {
                increment: tip.amount
              },
              // Update appropriate tip type totals
              ...(tip.tipType === 'cash' ? { cashTips: { increment: tip.amount } } : { creditCardTips: { increment: tip.amount } })
            }
          });
        }
        logger.info(`CSV Import: Updated ${tipsWithShifts.length} shifts with imported tip totals`);
      }

      // Find any open payroll periods that might need recalculation
      const openPayrollPeriods = await prisma.payrollPeriod.findMany({
        where: {
          businessId,
          status: 'open',
          startDate: {
            lte: new Date(Math.max(...importedTips.map(t => t.timestamp.getTime())))
          },
          endDate: {
            gte: new Date(Math.min(...importedTips.map(t => t.timestamp.getTime())))
          }
        }
      });

      if (openPayrollPeriods.length > 0) {
        logger.info(`CSV Import: Found ${openPayrollPeriods.length} open payroll periods that may need recalculation due to tip imports`);
      }
    }

    res.json({
      success: true,
      imported: importedTips.length,
      errors,
      message: `Successfully imported ${importedTips.length} tips`,
      integrationInfo: {
        updatedShifts: importedTips.filter(tip => tip.shiftId).length,
        triggeredPayrollPeriods: importedTips.length > 0 ? 'Check payroll periods for potential recalculation' : null
      }
    });
  } catch (error) {
    logger.error('Error importing tips from CSV:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error importing tips',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
