import { logger } from '../../lib/infrastructure/Logger';
import express from 'express';
import cors from 'cors';
import path from 'path';
import type { Server } from 'http';
import { getPrismaClient, registerDatabaseMaintenanceDrain } from './database';
import { apiRequestLifecycle, trackedHandler, waitForApiRequestsToDrain, waitForAllApiRequestsToDrain } from './middleware/request-lifecycle';
import authRoutes from './routes/auth';
import businessRoutes from './routes/business';
import tipsRoutes from './routes/tips';
import shiftsRoutes from './routes/shifts';
import payrollRoutes from './routes/payroll';
import analyticsRoutes from './routes/analytics';
import employeesRoutes from './routes/employees';
import databaseRoutes from './routes/database';
import tipDistributionRoutes from './routes/tip-distribution';
import posRoutes from './routes/pos';
import { scheduleAnalyticsCollection, stopAnalyticsCollection } from './services/analytics-scheduler';
import { protect } from './routes/auth';
import { authorizeApiRequest, requireDesktopToken } from './middleware/api-security';
import { AuthenticatedRequest, getBusinessId } from './types/express';
import { createSecurityHeaders } from '../../lib/security/headers';
import { employeeResponse } from './middleware/sensitive-fields';
import { businessDateRange, payPolicy } from './middleware/payroll-policy';
import { apiRateLimiter } from '../../lib/security/rate-limit';
import type { PayrollPeriod, TipEntry, Shift, PayrollEntry } from '@prisma/client';
import { z } from 'zod';
import { queryRange, RequestRangeError } from './middleware/query-range';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || 'localhost';
let activeServer: Server | null = null;
registerDatabaseMaintenanceDrain(waitForApiRequestsToDrain);

// Middleware
app.disable('x-powered-by');
export function parseTrustProxy(value?: string): boolean | number | string {
  if (!value || value === 'false') return false;
  if (value === 'true') return 1;
  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    if (hops > 10) throw new Error('TRUST_PROXY hop count must be between 0 and 10');
    return hops;
  }
  return value; // Explicit proxy addresses or subnet names supported by Express.
}
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
app.use(createSecurityHeaders());
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (process.env.SHIFTMINT_RUNTIME !== 'web' && !['localhost', '127.0.0.1', '[::1]', '::1'].includes(req.hostname)) {
    res.status(403).json({ message: 'Host is not allowed' }); return;
  }
  if (!origin) { next(); return; }
  const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  const desktopOrigins = process.env.SHIFTMINT_RUNTIME === 'web' ? [] : ['null', ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000'])];
  let sameOrigin = false;
  try { const parsed = new URL(origin); sameOrigin = parsed.host === req.get('host') && parsed.protocol === `${req.protocol}:`; } catch { /* File URLs have an opaque origin. */ }
  if (!sameOrigin && !allowedOrigins.includes(origin) && !desktopOrigins.includes(origin)) {
    res.status(403).json({ message: 'Origin is not allowed' }); return;
  }
  cors({ origin, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization', 'X-Bootstrap-Token', 'X-Desktop-Token'] })(req, res, next);
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'ShiftMint Backend Server is running',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api', requireDesktopToken, apiRequestLifecycle);
app.use('/api/auth', authRoutes);
// Every middleware promise must remain tracked across disconnects and handoffs.
app.use('/api', trackedHandler(protect), trackedHandler(apiRateLimiter), trackedHandler(authorizeApiRequest));
app.use('/api/business', businessRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/tips', tipsRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/tip-distribution', tipDistributionRoutes);
app.use('/api/pos', posRoutes);

// Export routes
app.post('/api/export', trackedHandler(async (req: AuthenticatedRequest, res) => {
  try {
    const calendar = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    const parsed = z.object({ type: z.enum(['employees', 'tips', 'shifts', 'payroll', 'comprehensive']), format: z.enum(['csv', 'json']).default('json'), startDate: calendar.optional(), endDate: calendar.optional(), options: z.object({ includeEmployeeDetails: z.boolean(), includeTipBreakdown: z.boolean(), includePayrollCalculations: z.boolean() }).partial().optional() }).safeParse(req.body);
    if (parsed.success === false) return res.status(400).json({ message: 'Invalid export request', errors: parsed.error.issues });
    const { type, format, startDate, endDate, options = {} } = parsed.data;
    if (type === 'comprehensive' && format !== 'json') return res.status(400).json({ message: 'Comprehensive exports require JSON to preserve sections and review metadata' });
    const prisma = getPrismaClient();
    const businessId = getBusinessId(req);
    const configuration = await prisma.businessConfiguration.findUnique({ where: { businessId } });
    const policy = payPolicy(configuration);
    const range = queryRange(startDate, endDate, policy.timeZone);
    const dateBounds = (field: string) => {
      return !range.start && !range.endExclusive ? {} : { [field]: { ...(range.start ? { gte: range.start } : {}), ...(range.endExclusive ? { lt: range.endExclusive } : {}) } };
    };
    const shiftBounds = { ...(range.endExclusive ? { startTime: { lt: range.endExclusive } } : {}), ...(range.start ? { OR: [{ endTime: { gt: range.start } }, { endTime: null }] } : {}) };
    const periodBounds = { ...(startDate ? { endDate: { gte: new Date(startDate) } } : {}), ...(endDate ? { startDate: { lte: new Date(endDate) } } : {}) };
    
    let data: any[] = [];
    
    switch (type) {
      case 'employees':
        data = await prisma.employee.findMany({
          where: {
            businessId,
          },
          orderBy: { createdAt: 'desc' }
        });
        break;
      case 'tips':
        data = await prisma.tipEntry.findMany({
          where: {
            businessId,
            ...dateBounds('timestamp'),
            complianceStatus: { not: 'voided' },
          },
          include: {
            shift: {
              select: {
                shiftDate: true,
                startTime: true,
                endTime: true,
                employeeId: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
        break;
      case 'shifts':
        data = await prisma.shift.findMany({
          where: {
            businessId,
            ...shiftBounds,
          },
          include: {
            tipEntries: true
          },
          orderBy: { startTime: 'desc' }
        });
        break;
      case 'payroll': {
        // Get payroll periods with comprehensive employee data
        // When both startDate and endDate are provided, get the exact period
        const whereClause = { businessId, ...periodBounds };
        
        const payrollPeriods = await prisma.payrollPeriod.findMany({
          where: whereClause,
          include: { 
            payrollEntries: {
              include: {
                employee: true
              }
            }
          },
          orderBy: { startDate: 'desc' }
        });
        
        // Transform to include all employee payroll details with comprehensive information
        data = [];
        for (const period of payrollPeriods) {
          for (const entry of period.payrollEntries) {
            const employee = entry.employee;
            
            // Get the actual rates from employee data
            const hourlyRate = employee.hourlyRate;
            const overtimeRate = employee.overtimeRate || (hourlyRate * 1.5);
            
            // Format the comprehensive payroll record with all fields guaranteed
            // This must include exactly 30 fields for the CSV export
            const payrollRecord = {
              // Period Information
              periodStart: period.startDate || '',
              periodEnd: period.endDate || '',
              periodStatus: period.status || 'open',
              
              // Employee Information - ensure all fields exist
              employeeId: employee?.id || entry.employeeId || '',
              employeeName: employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : 'Unknown Employee',
              employeeNumber: employee?.employeeNumber || '',
              employeeEmail: employee?.email || '',
              employeePhone: employee?.phone || '',
              employeeDepartment: employee?.department || '',
              employeeRole: employee?.role || '',
              employeeStatus: employee?.status || 'active',
              
              // Rate Information (as numbers for proper CSV formatting)
              hourlyRate: Number(hourlyRate || 0),
              overtimeRate: Number(overtimeRate || 0),
              payType: employee?.payType || 'hourly',
              
              // Hours Worked (as numbers)
              regularHours: Number(entry.regularHours || 0),
              overtimeHours: Number(entry.overtimeHours || 0),
              totalHours: Number(entry.hoursWorked || 0),
              
              // Pay Breakdown (as numbers)
              regularPay: Number(entry.regularPay || 0),
              overtimePay: Number(entry.overtimePay || 0),
              grossPay: Number(entry.grossPay || 0),
              
              // Tips and Deductions (as numbers)
              totalTips: Number(entry.totalTips || 0),
              totalTaxes: Number(entry.totalTaxes || 0),
              taxTreatment: 'estimate-requires-review',
              taxRate: `${(policy.estimatedTaxRate * 100).toFixed(2)}% estimate`,
              
              // Net Pay (as number)
              netPay: Number(entry.netPay || 0),
              
              // Additional Information
              tipEligible: employee?.tipEligible ? 'Yes' : 'No',
              taxExemptions: Number(employee?.taxExemptions || 0),
              startDate: employee?.startDate || '',
              notes: entry.notes || '',
              
              // Calculated Metrics (as numbers)
              effectiveHourlyRate: entry.hoursWorked > 0 ? Number((entry.grossPay / entry.hoursWorked).toFixed(2)) : 0,
              totalCompensation: Number(entry.netPay || 0),
            };
            
            data.push(payrollRecord);
          }
        }
        
        // If no entries but periods exist, still return period info
        if (data.length === 0 && payrollPeriods.length > 0) {
          data = payrollPeriods.map((period: PayrollPeriod) => ({
            periodStart: period.startDate,
            periodEnd: period.endDate,
            periodStatus: period.status,
            totalTips: period.totalTips || 0,
            totalSales: period.totalSales || 0,
            notes: period.notes || '',
            message: 'No payroll entries for this period'
          }));
        }
        
        logger.info(`[Payroll Export] Found ${payrollPeriods.length} period(s) to export`);
        logger.info(`[Payroll Export] Exporting ${data.length} payroll records with comprehensive data`);
        
        // Log first record to verify structure
        if (data.length > 0) {
          const firstRecord = data[0];
          const fieldCount = Object.keys(firstRecord).length;
          logger.info(`[Payroll Export] First record has ${fieldCount} fields (expected: 30)`);
          logger.info('[Payroll Export] All field names:', Object.keys(firstRecord));
          
          // Verify critical fields exist
          const criticalFields = ['periodStart', 'periodEnd', 'employeeName', 'hourlyRate', 
                                  'regularHours', 'grossPay', 'netPay', 'totalCompensation'];
          const missingFields = criticalFields.filter(field => !(field in firstRecord));
          if (missingFields.length > 0) {
            logger.warn('[Payroll Export] Missing critical fields:', missingFields);
          } else {
            logger.info('[Payroll Export] All critical fields present ✓');
          }
          
        }
        break;
      }
      case 'comprehensive': {
        const details = options.includeEmployeeDetails !== false;
        const includeTips = options.includeTipBreakdown !== false;
        const includePayroll = options.includePayrollCalculations !== false;
        const employees = details ? await prisma.employee.findMany({
          where: { businessId },
          orderBy: { employeeNumber: 'asc' }
        }) : [];

        const shifts = await prisma.shift.findMany({
          where: {
            businessId,
            ...shiftBounds,
          },
          include: {
            ...(includeTips && details ? { tipEntries: { where: { complianceStatus: { not: 'voided' } } } } : {})
          },
          orderBy: { startTime: 'desc' }
        });

        const tips = includeTips ? await prisma.tipEntry.findMany({
          where: {
            businessId,
            ...dateBounds('timestamp'),
            complianceStatus: { not: 'voided' },
          },
          include: {
            shift: {
              select: {
                shiftDate: true,
                startTime: true,
                endTime: true,
                employeeId: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }) : [];

        const payrollPeriods = includePayroll ? await prisma.payrollPeriod.findMany({
          where: {
            businessId,
            ...periodBounds,
          },
          include: { 
            payrollEntries: true
          },
          orderBy: { startDate: 'desc' }
        }) : [];

        // Create comprehensive summary for tax filing
        data = [{
          exportDate: new Date().toISOString(),
          dateRange: { startDate, endDate },
          summary: {
            ...(details ? { totalEmployees: employees.length } : {}),
            totalShifts: shifts.length,
            ...(includeTips ? { totalTips: tips.reduce((sum: number, tip: TipEntry) => sum + tip.amount, 0) } : {}),
            totalHours: shifts.reduce((sum: number, shift: Shift) => {
              if (shift.startTime && shift.endTime && !['break', 'pending_review'].includes(shift.status)) {
                return sum + Math.max(0, (Math.min(shift.endTime.getTime(), range.endExclusive?.getTime() ?? Infinity) - Math.max(shift.startTime.getTime(), range.start?.getTime() ?? -Infinity)) / 3600000);
              }
              return sum;
            }, 0),
            ...(includePayroll ? { totalGrossPay: payrollPeriods.reduce((sum: number, period: any) =>
              sum + period.payrollEntries.reduce((entrySum: number, entry: PayrollEntry) => entrySum + entry.grossPay, 0), 0
            ),
            totalNetPay: payrollPeriods.reduce((sum: number, period: any) =>
              sum + period.payrollEntries.reduce((entrySum: number, entry: PayrollEntry) => entrySum + entry.netPay, 0), 0
            ),
            totalTaxes: payrollPeriods.reduce((sum: number, period: any) =>
              sum + period.payrollEntries.reduce((entrySum: number, entry: PayrollEntry) => entrySum + entry.totalTaxes, 0), 0
            ) } : {})
          },
          ...(details ? { employees: employees.map(employeeResponse) } : {}),
          shifts: shifts.map(shift => details ? (() => { const { tipEntries, totalTips, cashTips, creditCardTips, ...record } = shift as Shift & { tipEntries?: unknown }; return { ...record, ...(includeTips ? { tipEntries, totalTips, cashTips, creditCardTips } : {}) }; })() : { id: shift.id, employeeId: shift.employeeId, shiftDate: shift.shiftDate, startTime: shift.startTime, endTime: shift.endTime, status: shift.status, hourlyRate: shift.hourlyRate, durationMin: shift.durationMin }),
          ...(includeTips ? { tips: details ? tips : tips.map(tip => ({ id: tip.id, employeeId: tip.employeeId, amount: tip.amount, timestamp: tip.timestamp, tipType: tip.tipType, source: tip.source })) } : {}),
          ...(includePayroll ? { payrollPeriods: details ? payrollPeriods : payrollPeriods.map(period => ({ id: period.id, startDate: period.startDate, endDate: period.endDate, status: period.status, payrollEntries: period.payrollEntries.map(entry => ({ employeeId: entry.employeeId, regularHours: entry.regularHours, overtimeHours: entry.overtimeHours, grossPay: entry.grossPay, totalTips: entry.totalTips, totalTaxes: entry.totalTaxes, netPay: entry.netPay })) })) } : {})
        }];
        break;
      }
      default:
        return res.status(400).json({ message: 'Invalid export type' });
    }
    
    // Log what we're sending back
    logger.info(`[Export Response] Sending ${Array.isArray(data) ? data.length : 1} records for ${type} export`);
    
    res.json({
      success: true,
      data: type === 'employees' ? data.map(employeeResponse) : data,
      ...(type === 'payroll' || type === 'comprehensive' ? { taxTreatment: 'estimate', warnings: ['Review withholding and reconcile with a payroll provider before filing or paying.', 'Payroll totals include whole overlapping payroll periods and are not prorated to the selected dates.'] } : {}),
      message: `${type} data exported successfully`,
      count: Array.isArray(data) ? data.length : 1
    });
  } catch (error) {
    if (error instanceof RequestRangeError) return res.status(400).json({ message: error.message });
    logger.error('Export error:', error);
    res.status(500).json({ message: 'Server error during export' });
  }
}));

if (process.env.SHIFTMINT_RUNTIME === 'web') {
  const frontendPath = path.resolve(process.env.FRONTEND_DIST || path.join(__dirname, '../../../dist'));
  app.use(express.static(frontendPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/api') { next(); return; }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: error.message })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

export function validateRuntimeSecrets(): void {
  const runtime = process.env.SHIFTMINT_RUNTIME;
  if (runtime !== 'web' && runtime !== 'desktop') throw new Error('SHIFTMINT_RUNTIME must be exactly web or desktop');
  if (runtime === 'desktop') return;
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('Hosted JWT_SECRET must contain at least 32 characters');
  if (!/^[a-f0-9]{64}$/i.test(process.env.ENCRYPTION_KEY || '')) throw new Error('Hosted ENCRYPTION_KEY must contain 64 hexadecimal characters');
  if (!process.env.BOOTSTRAP_TOKEN || process.env.BOOTSTRAP_TOKEN.length < 32) throw new Error('Hosted BOOTSTRAP_TOKEN must contain at least 32 characters');
  if (!(process.env.SHIFTMINT_DATA_DIR && path.isAbsolute(process.env.SHIFTMINT_DATA_DIR)) && !(process.env.DATABASE_URL?.startsWith('file:') && path.isAbsolute(process.env.DATABASE_URL.slice(5)))) throw new Error('Hosted storage requires an explicit absolute SHIFTMINT_DATA_DIR or SQLite DATABASE_URL');
}

export const startBackendServer = async (): Promise<void> => {
  validateRuntimeSecrets();
  if (process.env.SHIFTMINT_RUNTIME === 'web' && await getPrismaClient().business.count() > 1) throw new Error('Hosted ShiftMint supports one business per instance. Split a multi-business database offline before starting.');
  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(PORT, HOST, async () => {
        activeServer = server;
        logger.info(`ShiftMint Backend Server running on ${HOST}:${PORT}`);
        logger.info(`📊 Health check available at http://localhost:${PORT}/api/health`);
        
        // Initialize analytics scheduler
        try {
          if (process.env.SHIFTMINT_RUNTIME !== 'web' && process.env.ENABLE_ANALYTICS_SCHEDULER === 'true') await scheduleAnalyticsCollection();
          logger.info('✅ Analytics scheduler initialized');
        } catch (error) {
          logger.error('❌ Failed to initialize analytics scheduler:', error);
        }
        
        resolve();
      });
      
      server.on('error', (error: Error) => {
        logger.error('Failed to start backend server:', error);
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
};

export async function stopBackendServer(): Promise<void> {
  stopAnalyticsCollection();
  if (activeServer) {
    const server = activeServer;
    activeServer = null;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await waitForAllApiRequestsToDrain();
  }
}

// Start server directly when this file is executed
if (require.main === module) {
  (async () => {
    try {
      const { initializeDatabase } = await import('./database');
      validateRuntimeSecrets();
      await initializeDatabase();
      await startBackendServer();
      let shuttingDown = false;
      const shutdown = async () => {
        if (shuttingDown) return;
        shuttingDown = true;
        try { await stopBackendServer(); const { closeDatabase } = await import('./database'); await closeDatabase(); process.exitCode = 0; }
        catch (error) { logger.error('Backend shutdown failed:', error); process.exitCode = 1; }
      };
      process.once('SIGTERM', shutdown);
      process.once('SIGINT', shutdown);
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  })();
}

export default app;
