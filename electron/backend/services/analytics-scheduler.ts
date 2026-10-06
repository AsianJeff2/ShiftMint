import { logger } from '../../../lib/infrastructure/Logger';
import * as cron from 'node-cron';
import { getPrismaClient } from '../database';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';

const tasks: cron.ScheduledTask[] = [];
let startupTimer: ReturnType<typeof setTimeout> | undefined;
const enabled = () => process.env.SHIFTMINT_RUNTIME !== 'web' && process.env.ENABLE_ANALYTICS_SCHEDULER === 'true';
async function collectLocalAnalytics(): Promise<void> {
  if (!enabled()) return;
  const prisma = getPrismaClient();
  const user = await prisma.user.findFirst({ where: { role: 'owner' } });
  if (!user || !process.env.JWT_SECRET) return;
  const setting = await prisma.appSetting.findUnique({ where: { key: `analytics.enabled.v1:${user.businessId}` } });
  if (setting?.value !== 'true') return;
  const token = jwt.sign({ userId: user.id, businessId: user.businessId, credentialVersion: createHash('sha256').update(user.passwordHash).digest('hex') }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  const response = await fetch(`http://localhost:${Number(process.env.PORT || 3001)}/api/analytics/collect`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(process.env.SHIFTMINT_RUNTIME === 'desktop' ? { 'X-Desktop-Token': process.env.SHIFTMINT_DESKTOP_TOKEN || '' } : {}) }, body: '{}', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Local analytics request failed (${response.status})`);
}
const collect = () => { collectLocalAnalytics().catch(error => logger.error('Local analytics scheduler failed:', error)); };
export async function scheduleAnalyticsCollection(): Promise<void> {
  stopAnalyticsCollection();
  if (!enabled()) return;
  const prisma = getPrismaClient();
  const user = await prisma.user.findFirst({ where: { role: 'owner' } });
  if (!user) return;
  const setting = await prisma.appSetting.findUnique({ where: { key: `analytics.enabled.v1:${user.businessId}` } });
  if (setting?.value !== 'true') return;
  const configuration = await prisma.businessConfiguration.findUnique({ where: { businessId: user.businessId } });
  tasks.push(cron.schedule('0 3 * * *', collect, { timezone: configuration?.timeZone || 'UTC' }));
  tasks.push(cron.schedule('0 */6 * * *', collect));
  startupTimer = setTimeout(collect, 5000);
  startupTimer.unref();
}
export function stopAnalyticsCollection(): void {
  for (const task of tasks.splice(0)) { task.stop(); task.destroy(); }
  if (startupTimer) clearTimeout(startupTimer);
  startupTimer = undefined;
}
export async function reinitializeAnalyticsScheduler(): Promise<void> { await scheduleAnalyticsCollection(); }
