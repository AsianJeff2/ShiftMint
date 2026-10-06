export class PosError extends Error {
  constructor(public code: string, message: string, public status = 502, public retryAfterSeconds?: number) {
    super(message);
    this.name = 'PosError';
  }
}

export interface PosTransportOptions {
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  toastBaseUrl?: string;
}

export class PosTransport {
  private startedAt = Date.now();
  private lastToastOrdersRequest = 0;
  constructor(private options: PosTransportOptions = {}) {}

  async request(url: string, headers: Record<string, string>, body?: unknown): Promise<Record<string, unknown> | unknown[]> {
    if (Date.now() - this.startedAt > 90_000) {
      throw new PosError('PREVIEW_TOO_LARGE', 'Preview exceeded its time limit. Choose a shorter date range.', 422);
    }
    try {
      const response = await (this.options.fetch ?? fetch)(url, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
      });
      if (!response.ok) {
        const retryAfter = Number(response.headers.get('retry-after'));
        if (response.status === 429) {
          throw new PosError('PROVIDER_RATE_LIMITED', 'The POS provider rate limited this request. Wait before retrying.', 429,
            Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 3600) : undefined);
        }
        if (response.status === 401) throw new PosError('PROVIDER_UNAUTHORIZED', 'POS credentials expired or were rejected. Reconnect the provider.', 422);
        if (response.status === 403) throw new PosError('PROVIDER_PERMISSION_DENIED', 'These credentials do not grant access to the requested location or read scope.', 422);
        throw new PosError('PROVIDER_UNAVAILABLE', `The POS provider returned HTTP ${response.status}. Retry later.`);
      }
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object') throw new PosError('PROVIDER_INVALID_RESPONSE', 'The POS provider returned an invalid response.');
      return payload as Record<string, unknown> | unknown[];
    } catch (error) {
      if (error instanceof PosError) throw error;
      throw new PosError('PROVIDER_NETWORK_ERROR', 'The POS provider could not be reached or returned invalid data.');
    }
  }

  async paceToastOrders(): Promise<void> {
    const wait = Math.max(0, 5_000 - (Date.now() - this.lastToastOrdersRequest));
    if (wait > 0) await (this.options.sleep ?? ((ms) => new Promise(resolve => setTimeout(resolve, ms))))(wait);
    this.lastToastOrdersRequest = Date.now();
  }

  toastBaseUrl(): string {
    const configured = this.options.toastBaseUrl ?? process.env.TOAST_API_BASE_URL;
    if (!configured) throw new PosError('TOAST_HOST_REQUIRED', 'The server administrator must set TOAST_API_BASE_URL to the API Access URL shown in Toast Web.', 503);
    let url: URL;
    try { url = new URL(configured); } catch { throw new PosError('TOAST_HOST_INVALID', 'The configured Toast API host is invalid.', 503); }
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.toasttab.com') || url.port || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
      throw new PosError('TOAST_HOST_INVALID', 'TOAST_API_BASE_URL must be an HTTPS Toast API hostname without a path.', 503);
    }
    return url.origin;
  }
}

export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(object) : [];
}

export function text(value: unknown): string { return typeof value === 'string' ? value : ''; }

export function minor(value: unknown, dollars = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new PosError('PROVIDER_INVALID_MONEY', 'The POS provider returned invalid monetary data.');
  const amount = dollars ? Math.round(value * 100) : value;
  if (!Number.isSafeInteger(amount)) throw new PosError('PROVIDER_INVALID_MONEY', 'The POS provider returned an unsupported monetary amount.');
  return amount;
}

export function money(value: unknown): number {
  const amount = object(value).amount;
  return amount === undefined ? 0 : minor(amount);
}

export function assertRange(input: { startDate: string; endDate: string }): void {
  const start = Date.parse(input.startDate);
  const end = Date.parse(input.endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 28 * 86400_000) {
    throw new PosError('INVALID_DATE_RANGE', 'Choose a valid start and end time no more than 28 days apart.', 400);
  }
}
