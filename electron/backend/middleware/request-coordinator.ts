import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Serialize writes and drain admitted requests after their tracked work settles. */
export function createRequestCoordinator(isMaintenance: () => boolean, waitMs = 10000) {
  type State = { pending: number; finished: boolean; release: () => void };
  const requests = new WeakMap<Request, State>();
  let mutationTail = Promise.resolve();
  let active = 0;
  const listeners = new Set<() => void>();
  const complete = (state: State) => { if (state.finished && state.pending === 0) state.release(); };
  const track = (handler: RequestHandler): RequestHandler => (req, res, next) => {
    const state = requests.get(req);
    if (state) state.pending++;
    const done = () => { if (state) { state.pending--; complete(state); } };
    try {
      const result = (handler as unknown as (req: Request, res: Response, next: NextFunction) => unknown)(req, res, next);
      if (result && typeof (result as Promise<unknown>).then === 'function') return Promise.resolve(result).catch(next).finally(done);
      done();
    } catch (error) { next(error); done(); }
  };
  const middleware = (req: Request, res: Response, next: NextFunction) => {
    let canceled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const begin = (unlock: () => void = () => {}) => {
      if (timer) clearTimeout(timer);
      if (canceled || res.destroyed) { unlock(); return; }
      if (isMaintenance()) { res.status(503).json({ message: 'Database maintenance is in progress; retry shortly' }); unlock(); return; }
      active++;
      let released = false;
      // Dispatch itself is pending until next() has handed off to tracked middleware.
      const state: State = { pending: 1, finished: false, release: () => {
        if (released) return;
        released = true; active--; requests.delete(req); unlock();
        for (const listener of listeners) listener();
      } };
      requests.set(req, state);
      const finish = () => { state.finished = true; complete(state); };
      res.once('finish', finish); res.once('close', finish);
      try { next(); }
      finally { state.pending--; complete(state); }
    };
    if (isMaintenance()) { res.status(503).json({ message: 'Database maintenance is in progress; retry shortly' }); return; }
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) { begin(); return; }
    const previous = mutationTail;
    let unlock!: () => void;
    const lock = new Promise<void>(resolve => { unlock = resolve; });
    mutationTail = previous.then(() => lock);
    timer = setTimeout(() => { canceled = true; if (!res.destroyed) res.status(503).json({ message: 'Another write is in progress; retry shortly' }); }, waitMs);
    res.once('close', () => { canceled = true; });
    previous.then(() => begin(unlock));
  };
  const drain = (excludedRequests = 1) => {
    if (active <= excludedRequests) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const check = () => { if (active <= excludedRequests) { clearTimeout(timer); listeners.delete(check); resolve(); } };
      const timer = setTimeout(() => { listeners.delete(check); reject(new Error('Requests did not drain; restore canceled')); }, waitMs);
      listeners.add(check);
    });
  };
  return { middleware, track, drain };
}
