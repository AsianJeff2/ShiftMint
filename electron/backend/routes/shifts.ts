import { logger } from '../../../lib/infrastructure/Logger';
import { Router } from 'express';
import { managedRouter } from '../middleware/request-lifecycle';
import { getPrismaClient } from '../database';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { protect } from './auth';
import type { Shift, Employee } from '@prisma/client';
import {
  CreateShiftRequestSchema,
  UpdateShiftRequestSchema,
  ClockInRequestSchema,
  ClockOutRequestSchema,
  OffsetTimestampSchema,
  validateRequest,
  type ApiResponse,
} from '../../../lib/types/api-dtos';
import { AuthenticatedRequest, IdParamRequest, getBusinessId } from '../types/express';
import { calculateShiftPayDetails, payPolicy, dateInZone, workweekStart, PayrollSourceError } from '../middleware/payroll-policy';
import { payrollShiftLocked } from '../middleware/locked-period';
import { randomUUID } from 'node:crypto';
import { employeeResponse } from '../middleware/sensitive-fields';
import { requirePermission } from '../middleware/permissions';
import { Permission } from '../../../lib/security/rbac';
import { queryRange, pageInteger, RequestRangeError } from '../middleware/query-range';

const router = managedRouter();

// Note: Using proper JWT auth middleware imported from './auth'

// Helper function to calculate duration
const calculateDuration = (startTime: Date, endTime: Date): number => {
  return Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // Duration in minutes
};

// @route   GET /api/shifts
// @desc    Get all shifts for the user
// @access  Private
router.get('/', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const { startDate, endDate, status, limit, offset, employeeId } = req.query;
    const policy = payPolicy(await prisma.businessConfiguration.findUnique({ where: { businessId: getBusinessId(req) } }));
    const range = queryRange(startDate, endDate, policy.timeZone);
    const skip = pageInteger(offset, 0, 1000000);
    const take = limit === undefined ? undefined : pageInteger(limit, 100, 10000);
    if (take === 0) return res.status(400).json({ message: 'Limit must be positive' });
    
    const where: Prisma.ShiftWhereInput = {
      businessId: getBusinessId(req), // Ensure user can only see their business shifts
    };
    
    if (range.endExclusive) where.startTime = { lt: range.endExclusive };
    if (range.start) where.OR = [{ endTime: { gt: range.start } }, { endTime: null }];
    if (employeeId !== undefined) {
      if (typeof employeeId !== 'string' || !employeeId) return res.status(400).json({ message: 'Invalid employee filter' });
      where.employeeId = employeeId;
    }
    
    if (status && typeof status === 'string') {
      where.status = status;
    }

    // Only apply limit if explicitly provided, otherwise get all shifts
    const queryOptions: Prisma.ShiftFindManyArgs = {
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      include: {
        tipEntries: true,
      },
    };
    
    if (take !== undefined) queryOptions.take = take;

    const shifts = await prisma.shift.findMany(queryOptions);

    // Calculate duration for each shift
    const shiftsWithDuration = shifts.map((shift: Shift) => ({
      ...shift,
      durationMin: shift.endTime 
        ? calculateDuration(shift.startTime, shift.endTime)
        : shift.startTime 
          ? calculateDuration(shift.startTime, new Date())
          : 0,
    }));

    res.json({
      success: true,
      shifts: shiftsWithDuration,
    });
  } catch (error) {
    if (error instanceof RequestRangeError) return res.status(400).json({ message: error.message });
    logger.error('Error fetching shifts:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching shifts' 
    });
  }
});

// @route   GET /api/shifts/by-employee
// @desc    Get shifts grouped by employee
// @access  Private
router.get('/by-employee', protect, requirePermission(Permission.PAYROLL_VIEW), async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const businessId = getBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: 'Business ID not found in token' });
    }

    const configuration = await prisma.businessConfiguration.findUnique({ where: { businessId } });
    const policy = payPolicy(configuration);
    const range = queryRange(req.query.startDate, req.query.endDate, policy.timeZone);
    const whereConditions: Prisma.ShiftWhereInput = { businessId };
    if (range.endExclusive) whereConditions.startTime = { lt: range.endExclusive };
    if (range.start) whereConditions.endTime = { gt: workweekStart(range.start, policy) };

    // Get all employees
    const employees = await prisma.employee.findMany({
      where: { businessId },
      orderBy: { lastName: 'asc' }
    });

    // Get all shifts
    const shifts = await prisma.shift.findMany({
      where: whereConditions,
      orderBy: { startTime: 'desc' }
    });

    const groups = new Map<string, Shift[]>();
    for (const shift of shifts) if (shift.employeeId) { const group = groups.get(shift.employeeId) || []; group.push(shift); groups.set(shift.employeeId, group); }
    const issues: { employeeId: string; shiftIds: string[]; message: string }[] = [];
    const employeeShiftData = employees.flatMap((employee: Employee) => {
      const employeeShifts = groups.get(employee.id) || [];
      const visible = (shift: Shift) => (!range.endExclusive || shift.startTime < range.endExclusive) && (!range.start || !shift.endTime || shift.endTime > range.start);
      if (!employeeShifts.some(visible)) return [];
      try {
        const calculation = calculateShiftPayDetails(employeeShifts, employee.hourlyRate, policy, range.start ? { start: range.start, endExclusive: range.endExclusive || new Date(8640000000000000) } : undefined);
        const totals = calculation.totals;
        return [{ employee: employeeResponse(employee), shifts: employeeShifts.flatMap((shift, index) => visible(shift) ? [{ ...shift, hoursWorked: calculation.details[index].regularHours + calculation.details[index].overtimeHours, regularWage: calculation.details[index].regularPay, overtimeWage: calculation.details[index].overtimePay, totalWage: calculation.details[index].grossPay }] : []), totalHours: totals.regularHours + totals.overtimeHours, totalWages: totals.grossPay, totalPay: totals.grossPay, ...totals }];
      } catch (error) {
        if (!(error instanceof PayrollSourceError)) throw error;
        issues.push({ employeeId: employee.id, shiftIds: error.shiftIds, message: error.message });
        return [];
      }
    });

    res.json({
      success: true,
      data: employeeShiftData,
      totalShifts: shifts.length,
      employeesWithShifts: employeeShiftData.length
      , issues, complete: issues.length === 0
    });
  } catch (error) {
    if (error instanceof RequestRangeError) return res.status(400).json({ message: error.message });
    logger.error('Error fetching shifts by employee:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching shifts by employee' 
    });
  }
});

// @route   POST /api/shifts
// @desc    Create a new shift
// @access  Private
router.post('/', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();

    // Validate request body with shared DTO
    const validation = validateRequest(CreateShiftRequestSchema, req.body);

    if (validation.success === false) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    const validatedData = validation.data;

    // Use authenticated user's business ID
    const businessId = getBusinessId(req);
    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'Business ID not found in token'
      });
    }
    
    const employee = validatedData.employeeId ? await prisma.employee.findFirst({ where: { id: validatedData.employeeId, businessId } }) : null;
    if (validatedData.employeeId && !employee) return res.status(404).json({ message: 'Employee not found' });
    const startTime = new Date(validatedData.startTime);
    const endTime = validatedData.endTime ? new Date(validatedData.endTime) : null;
    if (!Number.isFinite(startTime.getTime()) || (endTime && (!Number.isFinite(endTime.getTime()) || endTime < startTime))) return res.status(400).json({ message: 'Shift timestamps must be valid and ordered' });
    if (await payrollShiftLocked(businessId, startTime, endTime)) return res.status(409).json({ message: 'Reopen the payroll period before modifying its source shifts' });
    const policy = payPolicy(await prisma.businessConfiguration.findUnique({ where: { businessId } }));
    const shift = await prisma.shift.create({
      data: {
        businessId: businessId,
        employeeId: validatedData.employeeId || null, // Handle employee association
        shiftDate: validatedData.shiftDate || dateInZone(startTime, policy.timeZone),
        hourlyRate: validatedData.hourlyRate ?? employee?.hourlyRate ?? 0,
        startTime: new Date(validatedData.startTime),
        endTime: validatedData.endTime ? new Date(validatedData.endTime) : null,
        durationMin: endTime ? calculateDuration(startTime, endTime) : null,
        jobCode: validatedData.jobCode || 'server',
        locationId: validatedData.locationId || 'main',
        status: req.body.status === undefined && endTime ? 'completed' : validatedData.status,
        totalSales: validatedData.totalSales || 0,
        cashSales: validatedData.cashSales || 0,
        creditCardSales: validatedData.creditCardSales || 0,
        totalTips: validatedData.totalTips || 0,
        cashTips: validatedData.cashTips || 0,
        creditCardTips: validatedData.creditCardTips || 0,
        notes: validatedData.notes || '',
      },
    });

    const shiftWithDuration = {
      ...shift,
      durationMin: shift.endTime 
        ? calculateDuration(shift.startTime, shift.endTime)
        : calculateDuration(shift.startTime, new Date()),
    };

    res.status(201).json({
      success: true,
      data: shiftWithDuration,
      message: 'Shift created successfully',
    });
  } catch (error) {
    logger.error('Error creating shift:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error creating shift' 
    });
  }
});

// @route   PUT /api/shifts/:id
// @desc    Update a shift
// @access  Private
router.put('/:id', protect, async (req: IdParamRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const shiftId = req.params.id;

    // Validate request body with shared DTO
    const validation = validateRequest(UpdateShiftRequestSchema, req.body);

    if (validation.success === false) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    const validatedData = validation.data;

    // First find the shift by ID, then verify business ownership
    const existingShift = await prisma.shift.findFirst({
      where: {
        id: shiftId,
        businessId: getBusinessId(req), // Ensure user can only update their business shifts
      },
    });

    if (!existingShift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }
    if (await payrollShiftLocked(getBusinessId(req), existingShift.startTime, existingShift.endTime)) return res.status(409).json({ message: 'Reopen the payroll period before modifying its source shifts' });

    const updateData: Prisma.ShiftUpdateInput = { updatedAt: new Date() };
    const newStart = validatedData.startTime ? new Date(validatedData.startTime) : existingShift.startTime;
    const newEnd = validatedData.endTime !== undefined ? validatedData.endTime ? new Date(validatedData.endTime) : null : existingShift.endTime;
    if (!Number.isFinite(newStart.getTime()) || (newEnd && (!Number.isFinite(newEnd.getTime()) || newEnd < newStart))) return res.status(400).json({ message: 'Shift timestamps must be valid and ordered' });
    if (await payrollShiftLocked(getBusinessId(req), newStart, newEnd)) return res.status(409).json({ message: 'Reopen the payroll period before moving shifts into it' });
    updateData.durationMin = newEnd ? calculateDuration(newStart, newEnd) : null;
    if (validatedData.employeeId !== undefined) {
      const employee = validatedData.employeeId ? await prisma.employee.findFirst({ where: { id: validatedData.employeeId, businessId: getBusinessId(req) } }) : null;
      if (validatedData.employeeId && !employee) return res.status(404).json({ message: 'Employee not found' });
      updateData.employeeId = validatedData.employeeId || null;
      if (validatedData.employeeId !== existingShift.employeeId && validatedData.hourlyRate === undefined) updateData.hourlyRate = employee?.hourlyRate ?? 0;
    }
    
    if (validatedData.startTime) {
      updateData.startTime = new Date(validatedData.startTime);
      const policy = payPolicy(await prisma.businessConfiguration.findUnique({ where: { businessId: getBusinessId(req) } }));
      updateData.shiftDate = validatedData.shiftDate || dateInZone(newStart, policy.timeZone);
    }
    if (validatedData.shiftDate !== undefined) updateData.shiftDate = validatedData.shiftDate;
    if (validatedData.hourlyRate !== undefined) updateData.hourlyRate = validatedData.hourlyRate;
    
    if (validatedData.endTime !== undefined) {
      updateData.endTime = newEnd;
    }
    
    if (validatedData.jobCode) {
      updateData.jobCode = validatedData.jobCode;
    }
    
    if (validatedData.locationId) {
      updateData.locationId = validatedData.locationId;
    }
    
    if (validatedData.status) {
      updateData.status = validatedData.status;
    }
    
    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes;
    }

    const updatedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: updateData,
      include: {
        tipEntries: true,
      },
    });

    const shiftWithDuration = {
      ...updatedShift,
      durationMin: updatedShift.endTime 
        ? calculateDuration(updatedShift.startTime, updatedShift.endTime)
        : calculateDuration(updatedShift.startTime, new Date()),
    };

    res.json({
      success: true,
      data: shiftWithDuration,
      message: 'Shift updated successfully',
    });
  } catch (error) {
    logger.error('Error updating shift:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error updating shift' 
    });
  }
});

// @route   DELETE /api/shifts/all/confirm
// @desc    Delete all shifts for the business
// @access  Private
router.delete('/all/confirm', protect, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'owner') return res.status(403).json({ message: 'Only an owner can delete all shifts' });
    if (req.body?.confirmation !== 'DELETE ALL SHIFTS') return res.status(400).json({ message: 'Type DELETE ALL SHIFTS to confirm deletion' });
    const prisma = getPrismaClient();
    const businessId = getBusinessId(req);
    
    if (!businessId) {
      return res.status(400).json({ message: 'Business ID not found in token' });
    }
    
    // Get count of shifts to be deleted for confirmation
    const lockedPeriods = await prisma.payrollPeriod.count({ where: { businessId, status: { in: ['closed', 'paid'] } } });
    if (lockedPeriods > 0) return res.status(409).json({ message: 'Bulk deletion is disabled while payroll periods are closed' });
    const shiftCount = await prisma.shift.count({
      where: { businessId }
    });
    
    if (shiftCount === 0) {
      return res.json({
        success: true,
        message: 'No shifts to delete',
        deletedCount: 0
      });
    }
    
    // Delete all shifts for this business
    const result = await prisma.$transaction(async transaction => {
      await transaction.appSetting.create({ data: { key: `audit.shift.bulk.v1:${randomUUID()}`, value: JSON.stringify({ businessId, userId: req.user!.userId, count: shiftCount, timestamp: new Date().toISOString(), action: 'delete_all_shifts' }) } });
      return transaction.shift.deleteMany({ where: { businessId } });
    });
    
    res.json({
      success: true,
      message: `Successfully deleted ${result.count} shifts`,
      deletedCount: result.count
    });
  } catch (error) {
    logger.error('Error deleting all shifts:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error deleting shifts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// @route   DELETE /api/shifts/:id
// @desc    Delete a single shift
// @access  Private
router.delete('/:id', protect, async (req: IdParamRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const shiftId = req.params.id;
    
    
    // First check if shift exists at all
    const shiftExists = await prisma.shift.findFirst({
      where: { id: shiftId, businessId: getBusinessId(req) }
    });
    
    logger.info('[DEBUG] Shift exists check:', {
      found: !!shiftExists,
      shiftBusinessId: shiftExists?.businessId,
      requestBusinessId: req.user?.businessId
    });
    
    if (!shiftExists) {
      return res.status(404).json({ 
        success: false,
        message: `Shift with ID ${shiftId} does not exist in database` 
      });
    }
    if (await payrollShiftLocked(getBusinessId(req), shiftExists.startTime, shiftExists.endTime)) return res.status(409).json({ message: 'Reopen the payroll period before deleting its source shifts' });
    
    // Check if user has permission to delete this shift
    const businessId = getBusinessId(req);
    if (shiftExists.businessId !== businessId) {
      logger.info('[DEBUG] Business ID mismatch:', {
        shiftBusinessId: shiftExists.businessId,
        userBusinessId: businessId
      });
      return res.status(403).json({ 
        success: false,
        message: 'You do not have permission to delete this shift' 
      });
    }

    await prisma.shift.delete({
      where: { id: shiftId },
    });

    res.json({
      success: true,
      message: 'Shift deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting shift:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error deleting shift' 
    });
  }
});

// @route   POST /api/shifts/clock-in
// @desc    Clock in to start a new shift
// @access  Private
router.post('/clock-in', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();

    // Validate request body with shared DTO
    const validation = validateRequest(ClockInRequestSchema, req.body);

    if (validation.success === false) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    const { jobCode } = validation.data;
    
    const business = await prisma.business.findFirst({ where: { id: getBusinessId(req) } });
    if (!business) {
      return res.status(400).json({ message: 'Business not found' });
    }
    const employeeId = req.body.employeeId;
    if (typeof employeeId !== 'string' || !employeeId) return res.status(400).json({ message: 'Select an employee before clocking in' });
    const employee = await prisma.employee.findFirst({ where: { id: employeeId, businessId: business.id, status: 'active' } });
    if (!employee) return res.status(404).json({ message: 'Active employee not found' });
    
    // Check if there's already an active shift
    const activeShift = await prisma.shift.findFirst({
      where: {
        businessId: business.id,
        employeeId,
        endTime: null,
      },
    });

    if (activeShift) {
      return res.status(400).json({
        message: 'You are already clocked in. Please clock out first.',
        activeShift,
      });
    }

    const now = new Date();
    if (await payrollShiftLocked(business.id, now)) return res.status(409).json({ message: 'Reopen the payroll period before adding its source shifts' });
    if (!Number.isFinite(employee.hourlyRate) || employee.hourlyRate <= 0) return res.status(422).json({ message: 'Review the employee hourly rate before clocking in' });
    const policy = payPolicy(await prisma.businessConfiguration.findUnique({ where: { businessId: business.id } }));
    const shift = await prisma.shift.create({
      data: {
        businessId: business.id,
        employeeId,
        shiftDate: dateInZone(now, policy.timeZone),
        hourlyRate: employee.hourlyRate,
        startTime: now,
        jobCode: jobCode || 'server',
        locationId: 'main',
        status: 'active',
        notes: jobCode ? `Job: ${jobCode}` : undefined,
      },
    });

    // Create clock-in punch event
    await prisma.punchEvent.create({
      data: {
        businessId: business.id,
        shiftId: shift.id,
        punchType: 'clock_in',
        punchTime: now,
        notes: jobCode ? `Clocked in for ${jobCode}` : 'Clocked in',
      },
    });

    const shiftWithDuration = {
      ...shift,
      durationMin: 0,
    };

    res.status(201).json({
      success: true,
      data: shiftWithDuration,
      message: 'Successfully clocked in',
    });
  } catch (error) {
    logger.error('Error clocking in:', error);
    res.status(500).json({ message: 'Server error clocking in' });
  }
});

// @route   POST /api/shifts/clock-out
// @desc    Clock out to end the current shift
// @access  Private
router.post('/clock-out', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();

    // Validate request body with shared DTO
    const validation = validateRequest(ClockOutRequestSchema, req.body);

    if (validation.success === false) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    const { shiftId } = validation.data;
    
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, businessId: getBusinessId(req) },
    });

    if (!shift) {
      return res.status(404).json({ 
        success: false,
        message: 'Shift not found' 
      });
    }

    if (shift.endTime) {
      return res.status(400).json({ message: 'Shift is already clocked out' });
    }

    const now = new Date();
    if (await payrollShiftLocked(getBusinessId(req), shift.startTime, now)) return res.status(409).json({ message: 'Reopen the payroll period before modifying its source shifts' });
    const updatedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        endTime: now,
        status: 'completed',
        durationMin: calculateDuration(shift.startTime, now),
        updatedAt: now,
      },
      include: {
        tipEntries: true,
      },
    });

    // Create clock-out punch event
    await prisma.punchEvent.create({
      data: {
        businessId: shift.businessId,
        shiftId: shift.id,
        punchType: 'clock_out',
        punchTime: now,
        notes: 'Clocked out',
      },
    });

    const shiftWithDuration = {
      ...updatedShift,
      durationMin: calculateDuration(updatedShift.startTime, now),
    };

    res.json({
      success: true,
      data: shiftWithDuration,
      message: 'Successfully clocked out',
    });
  } catch (error) {
    logger.error('Error clocking out:', error);
    res.status(500).json({ message: 'Server error clocking out' });
  }
});

// @route   GET /api/shifts/active
// @desc    Get the currently active shift
// @access  Private
router.get('/active', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    
    const business = await prisma.business.findFirst({ where: { id: getBusinessId(req) } });
    if (!business) {
      return res.status(400).json({ message: 'Business not found' });
    }
    
    const activeShift = await prisma.shift.findFirst({
      where: {
        businessId: business.id,
        ...(typeof req.query.employeeId === 'string' ? { employeeId: req.query.employeeId } : {}),
        endTime: null,
      },
      include: {
        tipEntries: true,
      },
    });

    if (!activeShift) {
      return res.json({
        success: true,
        activeShift: null,
      });
    }

    const shiftWithDuration = {
      ...activeShift,
      durationMin: calculateDuration(activeShift.startTime, new Date()),
    };

    res.json({
      success: true,
      activeShift: shiftWithDuration,
    });
  } catch (error) {
    logger.error('Error fetching active shift:', error);
    res.status(500).json({ message: 'Server error fetching active shift' });
  }
});

// Imported records must describe real employees and timestamps. Invalid rows are rejected.
const csvRowSchema = z.object({
  employeeId: z.string().optional(), employeeName: z.string().optional(),
  startTime: OffsetTimestampSchema, endTime: OffsetTimestampSchema.or(z.literal('')).optional(),
  hourlyRate: z.union([z.string(), z.number()]).optional(),
  jobCode: z.string().optional(), position: z.string().optional(), locationId: z.string().optional(),
  type: z.enum(['work', 'break']).optional(), status: z.enum(['active', 'completed', 'break', 'pending_review']).optional(),
  notes: z.string().optional(),
});
router.post('/import-csv', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const businessId = getBusinessId(req);
    const { csvData } = req.body;
    if (!Array.isArray(csvData) || csvData.length > 5000) return res.status(400).json({ message: 'Provide at most 5000 CSV rows' });
    const employees = await prisma.employee.findMany({ where: { businessId } });
    const policy = payPolicy(await prisma.businessConfiguration.findUnique({ where: { businessId } }));
    const errors: string[] = [];
    let imported = 0;
    for (let index = 0; index < csvData.length; index++) {
      try {
        const row = csvRowSchema.parse(csvData[index]);
        const matches = employees.filter(employee => row.employeeId ? employee.id === row.employeeId : [ `${employee.firstName} ${employee.lastName}`, `${employee.lastName}, ${employee.firstName}` ].some(name => name.toLowerCase() === row.employeeName?.trim().toLowerCase()));
        if (matches.length !== 1) throw new Error('Select one existing employee; names must match uniquely');
        const employee = matches[0];
        const startTime = new Date(row.startTime);
        const endTime = row.endTime ? new Date(row.endTime) : null;
        if (!Number.isFinite(startTime.getTime()) || (endTime && (!Number.isFinite(endTime.getTime()) || endTime <= startTime))) throw new Error('Valid ordered timestamps are required');
        const hourlyRate = row.hourlyRate === undefined || row.hourlyRate === '' ? employee.hourlyRate : Number(String(row.hourlyRate).replace(/[$,]/g, ''));
        const isBreak = row.type === 'break' || row.status === 'break';
        if (!isBreak && (!Number.isFinite(hourlyRate) || hourlyRate <= 0)) throw new Error('A positive hourly rate is required');
        if (await payrollShiftLocked(businessId, startTime, endTime)) throw new Error('Payroll period is closed');
        const duplicate = await prisma.shift.findFirst({ where: { businessId, employeeId: employee.id, startTime, endTime } });
        if (duplicate) throw new Error('Duplicate employee shift');
        await prisma.shift.create({ data: {
          businessId, employeeId: employee.id, startTime, endTime,
          shiftDate: dateInZone(startTime, policy.timeZone), durationMin: endTime ? calculateDuration(startTime, endTime) : null,
          hourlyRate: isBreak ? 0 : hourlyRate, jobCode: isBreak ? 'break' : row.jobCode || row.position || employee.role,
          position: row.position, employeeType: row.type || 'work', locationId: row.locationId || 'main',
          status: isBreak ? 'break' : row.status || (endTime ? 'completed' : 'active'), notes: row.notes,
        } });
        imported++;
      } catch (error) {
        errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Invalid row'}`);
      }
    }
    res.json({ success: true, imported, createdEmployees: 0, warnings: [], errors, message: `Imported ${imported} shifts; ${errors.length} rows rejected` });
  } catch (error) {
    logger.error('Error importing shifts:', error);
    res.status(500).json({ message: 'Could not import shifts' });
  }
});

export default router;
