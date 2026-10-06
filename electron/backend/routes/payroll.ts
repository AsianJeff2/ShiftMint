import { logger } from '../../../lib/infrastructure/Logger';
import { Router } from 'express';
import { managedRouter } from '../middleware/request-lifecycle';
import { getPrismaClient } from '../database';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { protect } from './auth';
import type { Employee, Shift, TipEntry } from '@prisma/client';
import {
  CreatePayrollPeriodRequestSchema,
  validateRequest,
  type ApiResponse,
} from '../../../lib/types/api-dtos';
import { AuthenticatedRequest, IdParamRequest, getBusinessId } from '../types/express';
import { businessDateRange, calculateShiftPay, PayPolicy, payPolicy, workweekStart, PayrollSourceError } from '../middleware/payroll-policy';
import { employeeResponse } from '../middleware/sensitive-fields';

const router = managedRouter();

async function getPayPolicy(businessId: string): Promise<PayPolicy> {
  const configuration = await getPrismaClient().businessConfiguration.findUnique({ where: { businessId } });
  return payPolicy(configuration);
}

// Note: Using proper JWT auth middleware imported from './auth'

// @route   GET /api/payroll/periods
// @desc    Get all payroll periods
// @access  Private
router.get('/periods', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    
    const periods = await prisma.payrollPeriod.findMany({
      where: { businessId: getBusinessId(req) },
      orderBy: { startDate: 'desc' },
      include: {
        payrollEntries: {
          include: {
            employee: true  // Include employee data for each payroll entry
          }
        },
      },
    });

    res.json({
      success: true,
      periods: periods.map(period => ({ ...period, payrollEntries: period.payrollEntries.map(entry => ({ ...entry, employee: employeeResponse(entry.employee) })) })),
    });
  } catch (error) {
    logger.error('Error fetching payroll periods:', error);
    res.status(500).json({ message: 'Server error fetching payroll periods' });
  }
});

// @route   POST /api/payroll/periods
// @desc    Create a new payroll period
// @access  Private
router.post('/periods', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();

    // Validate request body with shared DTO
    const validation = validateRequest(CreatePayrollPeriodRequestSchema, req.body);

    if (validation.success === false) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    const validatedData = validation.data;
    
    // Find or create a default business for single-business apps
    const business = await prisma.business.findFirst({ where: { id: getBusinessId(req) } });
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    if (!Number.isFinite(new Date(validatedData.startDate).getTime()) || !Number.isFinite(new Date(validatedData.endDate).getTime()) || new Date(validatedData.startDate) > new Date(validatedData.endDate)) return res.status(400).json({ message: 'Valid ordered payroll dates are required' });

    // Check for overlapping periods
    const overlappingPeriod = await prisma.payrollPeriod.findFirst({
      where: {
        businessId: business.id,
        OR: [
          {
            startDate: { lte: new Date(validatedData.endDate) },
            endDate: { gte: new Date(validatedData.startDate) },
          },
        ],
      },
    });

    if (overlappingPeriod) {
      return res.status(400).json({
        message: 'Payroll period overlaps with existing period',
        overlappingPeriod,
      });
    }

    const period = await prisma.payrollPeriod.create({
      data: {
        businessId: business.id,
        startDate: new Date(validatedData.startDate),
        endDate: new Date(validatedData.endDate),
        status: 'open',
        totalTips: 0,
        totalSales: 0,
        notes: validatedData.notes,
      },
      include: {
        payrollEntries: {
          include: {
            employee: true
          }
        },
      },
    });

    res.status(201).json({
      success: true,
      data: { ...period, payrollEntries: period.payrollEntries.map(entry => ({ ...entry, employee: employeeResponse(entry.employee) })) },
      message: 'Payroll period created successfully',
    });
  } catch (error) {
    logger.error('Error creating payroll period:', error);
    logger.error('Request body:', req.body);
    logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    res.status(500).json({ 
      success: false,
      message: 'Server error creating payroll period',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// @route   POST /api/payroll/periods/:id/calculate
// @desc    Calculate payroll for a specific period
// @access  Private
router.post('/periods/:id/calculate', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const periodId = req.params.id;
    
    const period = await prisma.payrollPeriod.findFirst({
      where: { id: periodId, businessId: getBusinessId(req) },
      include: {
        payrollEntries: {
          include: {
            employee: true
          }
        },
      },
    });

    if (!period) {
      return res.status(404).json({ message: 'Payroll period not found' });
    }
    if (period.status !== 'open') return res.status(409).json({ message: 'Reopen the period before recalculating. Paid periods cannot be recalculated.' });
    const policy = await getPayPolicy(getBusinessId(req));
    const range = businessDateRange(period.startDate, period.endDate, policy.timeZone);
    if (range.endExclusive > new Date()) return res.status(422).json({ message: 'Calculation closes payroll. Wait until the period has ended; ongoing period estimates are unavailable.' });

    // Get all shifts in this period with employee data
    const shifts = await prisma.shift.findMany({
      where: {
        businessId: getBusinessId(req),
        startTime: { lt: range.endExclusive },
        OR: [{ endTime: { gt: workweekStart(range.start, policy) } }, { endTime: null }],
        status: { not: 'break' },
      },
      include: {
        tipEntries: true,
      },
    });

    // Get all tips in this period
    const tips = await prisma.tipEntry.findMany({
      where: {
        businessId: getBusinessId(req),
        timestamp: {
          gte: range.start,
          lt: range.endExclusive,
        },
      },
    });

    // Get all employees to access their wage data
    const employees = await prisma.employee.findMany({
      where: {
        businessId: getBusinessId(req),
      },
    });
    const employeeIds = new Set(employees.map(employee => employee.id));
    const contextStart = workweekStart(range.start, policy);
    const unresolvedShifts = shifts.filter(shift => (!shift.employeeId || !employeeIds.has(shift.employeeId) || !shift.endTime || shift.status === 'pending_review') && shift.startTime < range.endExclusive && (!shift.endTime || shift.endTime > contextStart));
    if (unresolvedShifts.length) return res.status(422).json({ message: 'Review incomplete or unassigned shifts before payroll calculation', shiftIds: unresolvedShifts.map(shift => shift.id) });
    const unresolvedTips = tips.filter(tip => tip.amount !== 0 && ((!tip.employeeId || !employeeIds.has(tip.employeeId)) && employees.filter(employee => `${employee.firstName} ${employee.lastName}`.toLowerCase() === tip.serverName?.trim().toLowerCase()).length !== 1));
    if (unresolvedTips.length) return res.status(422).json({ message: 'Assign each tip to one employee before payroll calculation', tipIds: unresolvedTips.map(tip => tip.id) });

    // Group shifts and tips by employee for accurate calculation
    const employeeData = new Map();
    
    // Initialize employee data
    employees.forEach((employee: Employee) => {
      employeeData.set(employee.id, {
        employee,
        shifts: [],
        tips: [],
        totalHours: 0,
        totalTips: 0,
      });
    });

    // Associate shifts with employees (excluding breaks from hours calculation)
    shifts.forEach((shift: Shift) => {
      if (shift.employeeId && employeeData.has(shift.employeeId)) {
        const empData = employeeData.get(shift.employeeId);
        empData.shifts.push(shift);

        // Only count hours for non-break shifts
        if (shift.startTime && shift.endTime && shift.status !== 'break') {
          const duration = (shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60);
          empData.totalHours += duration;
        }
      }
    });

    // Associate tips with employees
    tips.forEach((tip: TipEntry) => {
      // First try to match by employeeId
      if (tip.employeeId && employeeData.has(tip.employeeId)) {
        const empData = employeeData.get(tip.employeeId);
        empData.tips.push(tip);
        empData.totalTips += tip.amount;
      } 
      // If no employeeId, try to match by serverName
      else if (tip.serverName) {
        // Find employee by matching serverName to employee's full name
        for (const [empId, empData] of employeeData) {
          const fullName = `${empData.employee.firstName} ${empData.employee.lastName}`;
          if (fullName.toLowerCase() === tip.serverName.trim().toLowerCase()) {
            empData.tips.push(tip);
            empData.totalTips += tip.amount;
            break; // Found a match, stop searching
          }
        }
      }
    });

    // Calculate totals across all employees
    let totalHours = 0;
    let totalTips = 0;
    let totalGrossPay = 0;
    let totalTaxes = 0;
    let totalNetPay = 0;
    
    const payrollEntries: {
      employeeId: string; employeeName: string; regularHours: number; overtimeHours: number;
      regularPay: number; overtimePay: number; grossPay: number; totalTips: number;
      totalTaxes: number; netPay: number; hoursWorked: number; hourlyWage: number;
      overtimeRate: number; shiftsCount: number; tipsCount: number;
    }[] = [];

    // Process each employee's payroll
    for (const [employeeId, empData] of employeeData) {
      if (empData.shifts.length === 0 && empData.tips.length === 0) continue;
      
      const { employee } = empData;
      let employeeHours = empData.totalHours;
      const employeeTips = empData.totalTips;
      
      const { regularHours, overtimeHours, regularPay, overtimePay, grossPay } = calculateShiftPay(empData.shifts, employee.hourlyRate, policy, range);
      employeeHours = regularHours + overtimeHours;
      if (employeeHours === 0 && employeeTips === 0) continue;
      const hourlyWage = regularHours > 0 ? regularPay / regularHours : employee.hourlyRate;
      const overtimeRate = overtimeHours > 0 ? overtimePay / overtimeHours : hourlyWage * 1.5;
      
      // Simple tax calculation (22% combined rate)
      const taxRate = policy.estimatedTaxRate;
      const taxes = Math.round((grossPay + employeeTips) * taxRate * 100) / 100;
      const netPay = Math.round((grossPay - taxes + employeeTips) * 100) / 100;
      
      // Add to totals
      totalHours += employeeHours;
      totalTips += employeeTips;
      totalGrossPay += grossPay;
      totalTaxes += taxes;
      totalNetPay += netPay;
      
      payrollEntries.push({
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        regularHours,
        overtimeHours,
        regularPay,
        overtimePay,
        grossPay,
        totalTips: employeeTips,
        totalTaxes: taxes,
        netPay,
        hoursWorked: employeeHours,
        hourlyWage,
        overtimeRate,
        shiftsCount: empData.shifts.filter((shift: Shift) => shift.status !== 'break' && shift.status !== 'pending_review' && shift.startTime < range.endExclusive && shift.endTime && shift.endTime > range.start).length,
        tipsCount: empData.tips.length,
      });
    }

    const periodShifts = shifts.filter(shift => shift.startTime >= range.start && shift.startTime < range.endExclusive);
    const totalSales = periodShifts.reduce((total: number, shift: Shift) => total + shift.totalSales, 0);

    // Create or update payroll entries for each employee
    const savedPayrollEntries: Prisma.PayrollEntryGetPayload<Record<string, never>>[] = [];
    
    await prisma.$transaction(async transaction => {
    const currentPeriod = await transaction.payrollPeriod.findFirst({ where: { id: periodId, businessId: getBusinessId(req), status: 'open' } });
    if (!currentPeriod) throw new Error('Payroll period was changed by another request');
    await transaction.payrollEntry.deleteMany({ where: { payrollPeriodId: periodId, employeeId: { notIn: payrollEntries.map(entry => entry.employeeId) } } });
    for (const entry of payrollEntries) {
      const savedEntry = await transaction.payrollEntry.upsert({
        where: { 
          payrollPeriodId_employeeId: { 
            payrollPeriodId: periodId,
            employeeId: entry.employeeId
          }
        },
        update: {
          regularHours: entry.regularHours,
          overtimeHours: entry.overtimeHours,
          regularPay: entry.regularPay,
          overtimePay: entry.overtimePay,
          grossPay: entry.grossPay,
          totalTips: entry.totalTips,
          totalTaxes: entry.totalTaxes,
          netPay: entry.netPay,
          hoursWorked: entry.hoursWorked,
          notes: `ESTIMATE: withholding requires review. ${entry.regularHours.toFixed(1)}h regular, ${entry.overtimeHours.toFixed(1)}h overtime - ${entry.shiftsCount} shifts, ${entry.tipsCount} tips`,
          updatedAt: new Date(),
        },
        create: {
          payrollPeriodId: periodId,
          employeeId: entry.employeeId,
          regularHours: entry.regularHours,
          overtimeHours: entry.overtimeHours,
          regularPay: entry.regularPay,
          overtimePay: entry.overtimePay,
          grossPay: entry.grossPay,
          totalTips: entry.totalTips,
          totalTaxes: entry.totalTaxes,
          netPay: entry.netPay,
          hoursWorked: entry.hoursWorked,
          notes: `ESTIMATE: withholding requires review. ${entry.regularHours.toFixed(1)}h regular, ${entry.overtimeHours.toFixed(1)}h overtime - ${entry.shiftsCount} shifts, ${entry.tipsCount} tips`,
        },
      });
      
      savedPayrollEntries.push(savedEntry);
    }

    // Update period totals
    await transaction.payrollPeriod.update({
      where: { id: periodId },
      data: {
        totalTips,
        totalSales,
        status: 'closed',
        updatedAt: new Date(),
      },
    });
    });

    const calculation = {
      periodId,
      taxTreatment: 'estimate',
      warnings: ['Withholding is an estimate. Review jurisdiction rules and reconcile with your payroll provider before payment.'],
      summary: {
        totalHours: totalHours.toFixed(1),
        totalGrossPay: totalGrossPay.toFixed(2),
        totalTips: totalTips.toFixed(2),
        totalTaxes: totalTaxes.toFixed(2),
        totalNetPay: totalNetPay.toFixed(2),
        employeeCount: payrollEntries.length,
        shiftsCount: periodShifts.length,
        tipsCount: tips.length,
      },
      employees: payrollEntries.map(entry => ({
        ...entry,
        regularHours: entry.regularHours.toFixed(1),
        overtimeHours: entry.overtimeHours.toFixed(1),
        regularPay: entry.regularPay.toFixed(2),
        overtimePay: entry.overtimePay.toFixed(2),
        grossPay: entry.grossPay.toFixed(2),
        totalTips: entry.totalTips.toFixed(2),
        totalTaxes: entry.totalTaxes.toFixed(2),
        netPay: entry.netPay.toFixed(2),
        hoursWorked: entry.hoursWorked.toFixed(1),
      })),
      payrollEntries: savedPayrollEntries,
    };

    const savedPeriod = await prisma.payrollPeriod.findFirst({
      where: { id: periodId, businessId: getBusinessId(req) },
      include: { payrollEntries: { include: { employee: true } } },
    });
    if (!savedPeriod) throw new Error('Calculated payroll period could not be loaded');
    const responsePeriod = { ...savedPeriod, payrollEntries: savedPeriod.payrollEntries.map(entry => ({ ...entry, employee: employeeResponse(entry.employee) })) };
    res.json({
      success: true,
      calculation,
      period: responsePeriod,
      entries: responsePeriod.payrollEntries,
      summary: {
        totalHours,
        totalGrossPay: Number(calculation.summary.totalGrossPay),
        totalTips: Number(calculation.summary.totalTips),
        totalTaxes: Number(calculation.summary.totalTaxes),
        totalNetPay: Number(calculation.summary.totalNetPay),
      },
      taxTreatment: calculation.taxTreatment,
      warnings: calculation.warnings,
      message: 'Payroll calculated successfully',
    });
  } catch (error) {
    if (error instanceof PayrollSourceError) return res.status(422).json({ message: error.message, shiftIds: error.shiftIds });
    logger.error('Error calculating payroll:', error);
    res.status(500).json({ message: 'Server error calculating payroll' });
  }
});

// @route   GET /api/payroll/periods/:id/summary
// @desc    Get payroll summary for a specific period
// @access  Private
router.get('/periods/:id/summary', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const periodId = req.params.id;
    
    const period = await prisma.payrollPeriod.findFirst({
      where: { id: periodId, businessId: getBusinessId(req) },
      include: {
        payrollEntries: {
          include: {
            employee: true
          }
        },
      },
    });

    if (!period) {
      return res.status(404).json({ message: 'Payroll period not found' });
    }

    // Get shifts and tips for this period
    const policy = await getPayPolicy(getBusinessId(req));
    const range = businessDateRange(period.startDate, period.endDate, policy.timeZone);
    const shifts = await prisma.shift.findMany({
      where: {
        businessId: getBusinessId(req),
        startTime: {
          gte: range.start,
          lt: range.endExclusive,
        },
      },
    });

    const tips = await prisma.tipEntry.findMany({
      where: {
        businessId: getBusinessId(req),
        timestamp: {
          gte: range.start,
          lt: range.endExclusive,
        },
      },
    });

    const summary = {
      period: {
        id: period.id,
        startDate: period.startDate,
        endDate: period.endDate,
        status: period.status,
      },
      totals: {
        shifts: shifts.length,
        tips: tips.length,
        totalTips: period.totalTips,
        totalSales: period.totalSales,
      },
      taxTreatment: 'estimate',
      warnings: ['Withholding estimates require review and payroll provider reconciliation.'],
      payrollEntries: period.payrollEntries.map(entry => ({ ...entry, employee: employeeResponse(entry.employee) })),
      shifts: shifts.map((shift: Shift) => ({
        id: shift.id,
        date: shift.shiftDate,
        startTime: shift.startTime,
        endTime: shift.endTime,
        duration: shift.endTime ?
          ((shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60)).toFixed(1) :
          '0',
        tips: shift.totalTips,
        sales: shift.totalSales,
      })),
      tipBreakdown: {
        cash: tips.filter((t: TipEntry) => t.tipType === 'cash').reduce((sum: number, t: TipEntry) => sum + t.amount, 0),
        credit: tips.filter((t: TipEntry) => t.tipType === 'credit').reduce((sum: number, t: TipEntry) => sum + t.amount, 0),
        other: tips.filter((t: TipEntry) => t.tipType === 'other').reduce((sum: number, t: TipEntry) => sum + t.amount, 0),
      },
    };

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    logger.error('Error fetching payroll summary:', error);
    res.status(500).json({ message: 'Server error fetching payroll summary' });
  }
});

// @route   PUT /api/payroll/periods/:id
// @desc    Update payroll period (dates, status, notes)
// @access  Private
router.put('/periods/:id', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const periodId = req.params.id;
    const { startDate, endDate, status, notes } = req.body;
    
    // Check if period exists
    const existingPeriod = await prisma.payrollPeriod.findFirst({
      where: { id: periodId, businessId: getBusinessId(req) }
    });

    if (!existingPeriod) {
      return res.status(404).json({ 
        success: false,
        message: 'Payroll period not found' 
      });
    }
    if (existingPeriod.status === 'paid') return res.status(409).json({ message: 'Paid payroll records are immutable' });
    if (status === 'paid') return res.status(409).json({ message: 'Estimated withholding cannot be marked paid. Reconcile with a payroll provider.' });
    if (status === 'closed') return res.status(422).json({ message: 'Calculate an ended payroll period to close it; direct closure is not allowed.' });
    if (existingPeriod.status !== 'open' && !(status === 'open' && req.user?.role === 'owner' && startDate === undefined && endDate === undefined && notes === undefined)) return res.status(409).json({ message: 'Only an owner can explicitly reopen a closed period before editing' });

    // Validate status if provided
    const validStatuses = ['open', 'closed', 'paid'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ') 
      });
    }

    // If dates are being updated, validate them
    let updateData: Prisma.PayrollPeriodUpdateInput = {};
    
    if (startDate !== undefined || endDate !== undefined) {
      const newStartDate = startDate ? new Date(startDate) : existingPeriod.startDate;
      const newEndDate = endDate ? new Date(endDate) : existingPeriod.endDate;
      
      // Validate date order
      if (!Number.isFinite(newStartDate.getTime()) || !Number.isFinite(newEndDate.getTime()) || newStartDate > newEndDate) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }

      // Check for overlapping periods (excluding current period)
      const overlappingPeriod = await prisma.payrollPeriod.findFirst({
        where: {
          id: { not: periodId },
          businessId: existingPeriod.businessId,
          OR: [
            {
              startDate: { lte: newEndDate },
              endDate: { gte: newStartDate },
            },
          ],
        },
      });

      if (overlappingPeriod) {
        return res.status(400).json({
          success: false,
          message: 'Updated dates would overlap with existing period',
          overlappingPeriod,
        });
      }

      if (startDate) updateData.startDate = newStartDate;
      if (endDate) updateData.endDate = newEndDate;
    }

    // Add other fields to update
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    updateData.updatedAt = new Date();

    const updatedPeriod = await prisma.payrollPeriod.update({
      where: { id: periodId },
      data: updateData,
      include: {
        payrollEntries: {
          include: {
            employee: true
          }
        },
      },
    });

    res.json({
      success: true,
      data: { ...updatedPeriod, payrollEntries: updatedPeriod.payrollEntries.map(entry => ({ ...entry, employee: employeeResponse(entry.employee) })) },
      message: 'Payroll period updated successfully',
    });
  } catch (error) {
    logger.error('Error updating payroll period:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error updating payroll period',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// @route   DELETE /api/payroll/periods/:id
// @desc    Delete a payroll period and its entries
// @access  Private
router.delete('/periods/:id', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const periodId = req.params.id;
    
    // Check if period exists
    const existingPeriod = await prisma.payrollPeriod.findFirst({
      where: { id: periodId, businessId: getBusinessId(req) },
      include: {
        payrollEntries: true
      }
    });

    if (!existingPeriod) {
      return res.status(404).json({ 
        success: false,
        message: 'Payroll period not found' 
      });
    }

    // Warn if period has been paid
    if (existingPeriod.status !== 'open') return res.status(409).json({ message: 'Closed and paid payroll records cannot be deleted' });

    // Delete the period (cascade will delete related payroll entries)
    await prisma.payrollPeriod.delete({
      where: { id: periodId }
    });

    res.json({
      success: true,
      message: 'Payroll period deleted successfully',
      deletedPeriod: {
        id: periodId,
        startDate: existingPeriod.startDate,
        endDate: existingPeriod.endDate,
        entriesDeleted: existingPeriod.payrollEntries.length
      }
    });
  } catch (error) {
    logger.error('Error deleting payroll period:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error deleting payroll period',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
