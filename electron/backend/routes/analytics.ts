import { Router } from 'express';
import { managedRouter } from '../middleware/request-lifecycle';
import { getPrismaClient } from '../database';
import { protect } from './auth';
import { AuthenticatedRequest, getBusinessId } from '../types/express';
import { reinitializeAnalyticsScheduler } from '../services/analytics-scheduler';
import { logger } from '../../../lib/infrastructure/Logger';

const router = managedRouter();
const keyFor = (businessId: string) => `analytics.enabled.v1:${businessId}`;
const permitted = () => process.env.SHIFTMINT_RUNTIME !== 'web' && process.env.ENABLE_ANALYTICS_SCHEDULER === 'true';
router.get('/settings', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const setting = await getPrismaClient().appSetting.findUnique({ where: { key: keyFor(getBusinessId(req)) } });
    res.json({ success: true, analyticsEnabled: permitted() && setting?.value === 'true', localOnly: true, schedulerPermitted: permitted() });
  } catch { res.status(500).json({ message: 'Could not read local analytics settings' }); }
});
router.put('/settings', protect, async (req: AuthenticatedRequest, res) => {
  if (typeof req.body.enabled !== 'boolean') return res.status(400).json({ message: 'enabled must be a boolean' });
  if (req.body.enabled && !permitted()) return res.status(409).json({ message: 'Local analytics requires explicit desktop scheduler opt-in' });
  try {
    const key = keyFor(getBusinessId(req));
    const value = String(req.body.enabled);
    await getPrismaClient().appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
    await reinitializeAnalyticsScheduler();
    res.json({ success: true, localOnly: true });
  } catch { res.status(500).json({ message: 'Could not save local analytics settings' }); }
});
router.post('/collect', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const businessId = getBusinessId(req);
    const setting = await prisma.appSetting.findUnique({ where: { key: keyFor(businessId) } });
    if (!permitted() || setting?.value !== 'true') return res.status(409).json({ message: 'Local analytics is disabled' });
    const [tips, shifts, payroll, employees] = await Promise.all([
      prisma.tipEntry.count({ where: { businessId } }), prisma.shift.count({ where: { businessId } }),
      prisma.payrollPeriod.count({ where: { businessId } }), prisma.employee.count({ where: { businessId } }),
    ]);
    await prisma.analyticsEntry.create({ data: { businessId, eventType: 'LOCAL_USAGE_STATS', eventData: JSON.stringify({ tips, shifts, payroll, employees }), appVersion: process.env.npm_package_version || '2.0.0' } });
    res.json({ success: true, localOnly: true });
  } catch (error) { logger.error('Local analytics collection failed:', error); res.status(500).json({ message: 'Could not collect local analytics' }); }
});
router.post('/transmit', protect, (_req, res) => {
  res.status(410).json({ success: false, message: 'External analytics transmission has been removed' });
});
export default router;
