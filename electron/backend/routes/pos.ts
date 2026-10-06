import { type Response, type NextFunction } from 'express';
import { managedRouter } from '../middleware/request-lifecycle';
import { z } from 'zod';
import { protect } from './auth';
import { type AuthenticatedRequest, getBusinessId } from '../types/express';
import { connectPos, disconnectPos, getPosConnections, previewPosConnection } from '../services/pos-connections';
import { PosError } from '../../../lib/pos/transport';

const router = managedRouter();
const providerSchema = z.enum(['square', 'toast']);
const squareSchema = z.object({
  provider: z.literal('square'), environment: z.enum(['production', 'sandbox']),
  accessToken: z.string().trim().min(8).max(4096),
  locationIds: z.array(z.string().trim().min(1).max(128)).min(1).max(20).refine(ids => new Set(ids).size === ids.length).optional(),
}).strict();
const toastSchema = z.object({
  provider: z.literal('toast'), clientId: z.string().trim().min(1).max(256),
  clientSecret: z.string().trim().min(1).max(4096),
  locationIds: z.array(z.string().uuid()).min(1).max(20).refine(ids => new Set(ids).size === ids.length),
  currency: z.enum(['USD', 'CAD', 'GBP', 'EUR', 'AUD']),
}).strict();
const connectSchema = z.discriminatedUnion('provider', [squareSchema, toastSchema]);
const previewSchema = z.object({
  startDate: z.string().datetime({ offset: true }), endDate: z.string().datetime({ offset: true }),
  includeLabor: z.boolean().default(false), includeCatalog: z.boolean().default(false),
}).strict();

function requirePosManager(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user?.businessId) { res.status(401).json({ success: false, message: 'Authentication required.' }); return; }
  if (!['owner', 'manager'].includes(req.user.role)) { res.status(403).json({ success: false, message: 'Owner or manager access is required for POS connections.' }); return; }
  next();
}

router.use(protect, requirePosManager);

function failure(res: Response, error: unknown): void {
  if (error instanceof z.ZodError) {
    // Zod issues can include input values; only expose a fixed validation message.
    res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Check the provider credentials, location IDs, currency and date range.' });
  } else if (error instanceof PosError) {
    if (error.retryAfterSeconds) res.setHeader('Retry-After', error.retryAfterSeconds);
    res.status(error.status).json({ success: false, code: error.code, message: error.message, retryAfterSeconds: error.retryAfterSeconds });
  } else {
    res.status(500).json({ success: false, code: 'POS_INTERNAL_ERROR', message: 'The POS operation could not be completed.' });
  }
}

router.get('/connections', async (req: AuthenticatedRequest, res) => {
  try { res.json({ success: true, data: await getPosConnections(getBusinessId(req)) }); }
  catch (error) { failure(res, error); }
});

router.post('/connections', async (req: AuthenticatedRequest, res) => {
  try { res.json({ success: true, data: await connectPos(getBusinessId(req), connectSchema.parse(req.body)) }); }
  catch (error) { failure(res, error); }
});

router.delete('/connections/:provider', async (req: AuthenticatedRequest, res) => {
  try {
    await disconnectPos(getBusinessId(req), providerSchema.parse(req.params.provider));
    res.json({ success: true, data: null });
  } catch (error) { failure(res, error); }
});

router.post('/connections/:provider/preview', async (req: AuthenticatedRequest, res) => {
  try { res.json({ success: true, data: await previewPosConnection(getBusinessId(req), providerSchema.parse(req.params.provider), previewSchema.parse(req.body)) }); }
  catch (error) { failure(res, error); }
});

export default router;
