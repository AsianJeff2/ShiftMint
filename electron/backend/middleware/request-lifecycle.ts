import { Router, type RequestHandler } from 'express';
import { isDatabaseMaintenanceInProgress } from '../database';
import { createRequestCoordinator } from './request-coordinator';

const coordinator = createRequestCoordinator(isDatabaseMaintenanceInProgress);
export const apiRequestLifecycle = coordinator.middleware;
export const trackedHandler = coordinator.track;
export const waitForApiRequestsToDrain = coordinator.drain;
export const waitForAllApiRequestsToDrain = () => coordinator.drain(0);

/** Track route promises after response close so database restore waits for actual work. */
export function managedRouter(): Router {
  const router = Router();
  const wrap = (value: unknown): unknown => Array.isArray(value) ? value.map(wrap) : typeof value === 'function' && value.length < 4 ? trackedHandler(value as RequestHandler) : value;
  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'use'] as const) {
    const register = router[method].bind(router);
    (router as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => (register as (...values: unknown[]) => Router)(...args.map(wrap));
  }
  return router;
}
