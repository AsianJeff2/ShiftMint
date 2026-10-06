import { logger } from '../../../lib/infrastructure/Logger';
import { Router } from 'express';
import { managedRouter } from '../middleware/request-lifecycle';
import { z } from 'zod';
import { getPrismaClient } from '../database';
import { protect } from './auth';
import { AuthenticatedRequest, getBusinessId } from '../types/express';
import { businessDateRange, calculateShiftPay, payPolicy, workweekStart, PayrollSourceError } from '../middleware/payroll-policy';

const router = managedRouter();
router.use(protect);
const settingsSchema = z.object({
  tipCollectionMethod: z.enum(['pos', 'manual', 'hybrid']), enableCashTips: z.boolean(),
  tipDistributionMethod: z.enum(['percentage', 'hours', 'hybrid']),
  enableKitchenTips: z.boolean(), kitchenTipPercentage: z.number().min(0).max(100),
  distributionRules: z.array(z.object({
    id: z.string().min(1), name: z.string().min(1), roles: z.array(z.string().min(1)).min(1),
    percentage: z.number().min(0).max(100), distributionMethod: z.enum(['equal', 'hours', 'points']),
    minimumHours: z.number().nonnegative().optional(), enabled: z.boolean(),
  })).max(100),
  requireMinimumHours: z.boolean(), minimumHoursThreshold: z.number().nonnegative(),
  enableTipPoints: z.boolean(), tipPointMultipliers: z.record(z.string(), z.number().nonnegative()),
  enableOvertimeBonus: z.boolean(), overtimeBonusMultiplier: z.number().min(1).max(10),
  enableShiftDifferentials: z.boolean(), shiftDifferentials: z.record(z.string(), z.number().nonnegative()),
}).superRefine((settings, context) => {
  const rules = settings.distributionRules.filter(rule => rule.enabled);
  if (Math.abs(rules.reduce((sum, rule) => sum + rule.percentage, 0) - 100) > 0.00001) context.addIssue({ code: 'custom', message: 'Enabled distribution percentages must total 100' });
  if (settings.enableTipPoints || settings.enableShiftDifferentials || rules.some(rule => rule.distributionMethod === 'points')) context.addIssue({ code: 'custom', message: 'Points and shift differentials are not implemented; use hours or equal distribution' });
});
const defaultSettings = {
  tipCollectionMethod: 'manual', enableCashTips: true, tipDistributionMethod: 'hours',
  enableKitchenTips: true, kitchenTipPercentage: 20,
  distributionRules: [
    { id: '1', name: 'Front of House', roles: ['server', 'bartender', 'host'], percentage: 80, distributionMethod: 'hours', minimumHours: 0, enabled: true },
    { id: '2', name: 'Back of House', roles: ['cook', 'prep cook', 'dishwasher'], percentage: 20, distributionMethod: 'hours', minimumHours: 0, enabled: true },
  ], requireMinimumHours: false, minimumHoursThreshold: 4, enableTipPoints: false, tipPointMultipliers: {},
  enableOvertimeBonus: false, overtimeBonusMultiplier: 1.5, enableShiftDifferentials: false, shiftDifferentials: {},
};
const settingKey = (businessId: string) => `tip.distribution.v1:${businessId}`;
router.post('/settings', async (req: AuthenticatedRequest, res) => {
  try {
    const settings = settingsSchema.safeParse(req.body);
    if (settings.success === false) return res.status(400).json({ success: false, message: 'Invalid tip distribution settings', errors: settings.error.issues });
    const key = settingKey(getBusinessId(req));
    const value = JSON.stringify(settings.data);
    await getPrismaClient().appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
    res.json({ success: true, message: 'Tip distribution settings saved' });
  } catch (error) { logger.error('Save distribution settings failed:', error); res.status(500).json({ message: 'Could not save settings' }); }
});
router.get('/settings/:businessId', async (req: AuthenticatedRequest, res) => {
  if (req.params.businessId !== getBusinessId(req)) return res.status(404).json({ message: 'Business not found' });
  try {
    const value = await getPrismaClient().appSetting.findUnique({ where: { key: settingKey(getBusinessId(req)) } });
    res.json({ success: true, settings: value ? settingsSchema.parse(JSON.parse(value.value)) : defaultSettings });
  } catch (error) { logger.error('Read distribution settings failed:', error); res.status(500).json({ message: 'Could not load settings' }); }
});
router.post('/calculate', async (req: AuthenticatedRequest, res) => {
  try {
    const settings = settingsSchema.safeParse(req.body.settings);
    if (settings.success === false || typeof req.body.periodId !== 'string') return res.status(400).json({ message: 'Valid period and settings required', errors: settings.success === false ? settings.error.issues : [] });
    const prisma = getPrismaClient();
    const businessId = getBusinessId(req);
    const period = await prisma.payrollPeriod.findFirst({ where: { id: req.body.periodId, businessId } });
    if (!period) return res.status(404).json({ message: 'Payroll period not found' });
    const configuration = await prisma.businessConfiguration.findUnique({ where: { businessId } });
    const policy = payPolicy(configuration);
    const range = businessDateRange(period.startDate, period.endDate, policy.timeZone);
    const tips = await prisma.tipEntry.findMany({ where: { businessId, complianceStatus: { not: 'voided' }, timestamp: { gte: range.start, lt: range.endExclusive }, ...(settings.data.enableCashTips ? {} : { tipType: { not: 'cash' } }) } });
    const shifts = await prisma.shift.findMany({ where: { businessId, startTime: { lt: range.endExclusive }, endTime: { gt: workweekStart(range.start, policy) }, status: { notIn: ['break', 'pending_review'] } } });
    const employees = await prisma.employee.findMany({ where: { businessId, tipEligible: true } });
    const employeeHours = employees.map(employee => {
      const totals = calculateShiftPay(shifts.filter(shift => shift.employeeId === employee.id), employee.hourlyRate, policy, range);
      return { employee: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName, role: employee.role }, ...totals, totalHours: totals.regularHours + totals.overtimeHours };
    }).filter(data => data.totalHours > 0);
    const poolCents = Math.round(tips.reduce((sum, tip) => sum + tip.amount, 0) * 100);
    const distribution = new Map<string, { employee: typeof employeeHours[number]['employee']; tipAmount: number; percentage: number; hours: number; calculations: { regularHours: number; overtimeHours: number; rules: unknown[] } }>();
    let ruleCentsUsed = 0;
    const rules = settings.data.distributionRules.filter(rule => rule.enabled);
    rules.forEach((rule, index) => {
      const ruleCents = index === rules.length - 1 ? poolCents - ruleCentsUsed : Math.round(poolCents * rule.percentage / 100);
      ruleCentsUsed += ruleCents;
      const eligible = employeeHours.filter(data => rule.roles.some(role => role.toLowerCase() === data.employee.role.toLowerCase()) && data.totalHours >= Math.max(rule.minimumHours || 0, settings.data.requireMinimumHours ? settings.data.minimumHoursThreshold : 0));
      const weights = eligible.map(data => rule.distributionMethod === 'equal' ? 1 : data.regularHours + data.overtimeHours * (settings.data.enableOvertimeBonus ? settings.data.overtimeBonusMultiplier : 1));
      const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
      if (weightTotal <= 0) return;
      const shares = eligible.map((data, employeeIndex) => ({ data, raw: ruleCents * weights[employeeIndex] / weightTotal, cents: Math.floor(ruleCents * weights[employeeIndex] / weightTotal) }));
      let remainder = ruleCents - shares.reduce((sum, share) => sum + share.cents, 0);
      const ordered = [...shares].sort((a, b) => (b.raw - b.cents) - (a.raw - a.cents) || a.data.employee.id.localeCompare(b.data.employee.id));
      for (const share of ordered) { if (remainder-- > 0) share.cents++; }
      for (const share of shares) {
        const data = share.data;
        let entry = distribution.get(data.employee.id);
        if (!entry) { entry = { employee: data.employee, tipAmount: 0, percentage: 0, hours: data.totalHours, calculations: { regularHours: data.regularHours, overtimeHours: data.overtimeHours, rules: [] } }; distribution.set(data.employee.id, entry); }
        entry.tipAmount = Math.round((entry.tipAmount + share.cents / 100) * 100) / 100;
        entry.calculations.rules.push({ ruleName: rule.name, rulePercentage: rule.percentage, tipShare: share.cents / 100, method: rule.distributionMethod });
      }
    });
    const totalTips = poolCents / 100;
    const entries = [...distribution.values()].map(entry => ({ ...entry, percentage: totalTips > 0 ? entry.tipAmount / totalTips * 100 : 0 }));
    const totalDistributed = Math.round(entries.reduce((sum, entry) => sum + entry.tipAmount, 0) * 100) / 100;
    res.json({ success: true, preview: true, warnings: ['Review eligible roles and local tip pooling rules before applying this preview. Payroll records are not changed.'], totalTips, totalEmployees: entries.length, distribution: entries,
      summary: { totalDistributed, undistributedTips: Math.round((totalTips - totalDistributed) * 100) / 100, averageTipPerEmployee: entries.length ? totalDistributed / entries.length : 0, totalHoursWorked: employeeHours.reduce((sum, data) => sum + data.totalHours, 0) } });
  } catch (error) { if (error instanceof PayrollSourceError) return res.status(422).json({ message: error.message, shiftIds: error.shiftIds }); logger.error('Tip distribution calculation failed:', error); res.status(500).json({ message: 'Could not calculate distribution' }); }
});
export default router;
