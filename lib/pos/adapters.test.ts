import { beforeEach, describe, expect, it, vi } from 'vitest';
import { previewPos, validatePosConnection, type PosConnectionRecord } from './adapters';
import { PosTransport } from './transport';

const range = { startDate: '2026-09-01T00:00:00Z', endDate: '2026-09-02T00:00:00Z' };
const toastHost = 'https://ws-api.toasttab.com';
function json(value: unknown, status = 200, headers?: Record<string, string>) { return new Response(JSON.stringify(value), { status, headers }); }
function square(): PosConnectionRecord {
  return { credentials: { provider: 'square', environment: 'sandbox', accessToken: 'square-private-token' }, connection: { provider: 'square', environment: 'sandbox', status: 'validated', validatedAt: '', warnings: [], locations: [{ id: 'L1', name: 'One', currency: 'USD' }, { id: 'L2', name: 'Two', currency: 'JPY' }] } };
}
function toast(): PosConnectionRecord {
  return { credentials: { provider: 'toast', clientId: 'client', clientSecret: 'toast-private-secret', currency: 'USD', locationIds: ['T1'] }, connection: { provider: 'toast', environment: 'production', status: 'validated', validatedAt: '', warnings: [], locations: [{ id: 'T1', name: 'One', currency: 'USD' }] } };
}
beforeEach(() => { vi.restoreAllMocks(); });

describe('POS adapters with mocked provider HTTP', () => {
  it('validates active Square locations and payment scope before saving a connection', async () => {
    const request = vi.fn().mockResolvedValueOnce(json({ locations: [{ id: 'L1', name: 'One', status: 'ACTIVE', currency: 'USD', timezone: 'America/New_York' }, { id: 'L2', status: 'INACTIVE' }] })).mockResolvedValueOnce(json({ payments: [] }));
    const record = await validatePosConnection(square().credentials, { fetch: request });
    expect(record.connection.locations).toEqual([{ id: 'L1', name: 'One', currency: 'USD', timeZone: 'America/New_York' }]);
    expect(new URL(request.mock.calls[1][0]).searchParams.get('location_id')).toBe('L1');
    expect(request.mock.calls[0][1].headers.Authorization).toBe('Bearer square-private-token');
    expect(request.mock.calls[0][1].headers['Square-Version']).toBe('2026-09-16');
    expect(JSON.stringify(record.connection)).not.toContain('square-private-token');
  });

  it('rejects Square locations that the merchant token cannot access', async () => {
    const request = vi.fn().mockResolvedValue(json({ locations: [{ id: 'L1', status: 'ACTIVE' }] }));
    await expect(validatePosConnection({ provider: 'square', environment: 'sandbox', accessToken: 'token', locationIds: ['other-merchant'] }, { fetch: request })).rejects.toMatchObject({ code: 'INVALID_LOCATIONS' });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('follows Square cursors across payments, timecards and catalog without losing currency minor units', async () => {
    const request = vi.fn(async (url: string, init: RequestInit) => {
      const parsed = new URL(url);
      if (parsed.pathname === '/v2/payments') {
        const location = parsed.searchParams.get('location_id');
        if (location === 'L1' && !parsed.searchParams.has('cursor')) return json({ payments: [{ id: 'P1', created_at: range.startDate, status: 'COMPLETED', amount_money: { amount: 1000, currency: 'USD' }, tip_money: { amount: 200 }, refunded_money: { amount: 50 }, card_details: { private: 'never-export' } }], cursor: 'next-payment' });
        return json({ payments: [{ id: location === 'L1' ? 'P2' : 'P3', created_at: range.startDate, amount_money: { amount: 250, currency: location === 'L1' ? 'USD' : 'JPY' } }, { id: 'excluded-at-end', created_at: range.endDate, amount_money: { amount: 100 } }] });
      }
      if (parsed.pathname === '/v2/labor/timecards/search') {
        const body = JSON.parse(String(init.body));
        expect(body.query.filter.start).toEqual({ start_at: range.startDate, end_at: range.endDate });
        if (body.query.filter.location_ids[0] === 'L1' && !body.cursor) return json({ timecards: [{ id: 'TC1', team_member_id: 'E1', start_at: range.startDate, declared_cash_tip_money: { amount: 175, currency: 'USD' } }], cursor: 'next-timecard' });
        return json({ timecards: [] });
      }
      return json({ objects: [{ id: 'I1', item_data: { name: 'Coffee', description: 'not exported' } }] });
    });
    const result = await previewPos(square(), { ...range, includeLabor: true, includeCatalog: true }, { fetch: request as typeof fetch });
    expect(result.sales.map(sale => sale.id)).toEqual(['P1', 'P2', 'P3']);
    expect(result.sales[0]).toMatchObject({ amountMinor: 1000, tipMinor: 200, refundedMinor: 50 });
    expect(result.sales[2]).toMatchObject({ currency: 'JPY', amountMinor: 250 });
    expect(result.labor[0]).toMatchObject({ employeeId: 'E1', declaredCashTipMinor: 175 });
    expect(result.catalog).toEqual([{ id: 'I1', name: 'Coffee' }]);
    expect(result.previewOnly).toBe(true);
    expect(JSON.stringify(result)).not.toContain('never-export');
    expect(JSON.stringify(result)).not.toContain('square-private-token');
  });

  it('stops repeated Square pagination rather than returning a truncated preview', async () => {
    const request = vi.fn().mockImplementation(async () => json({ payments: [], cursor: 'same' }));
    await expect(previewPos(square(), range, { fetch: request })).rejects.toMatchObject({ code: 'PROVIDER_INVALID_RESPONSE' });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('returns sanitized permission failures and a bounded Retry-After for throttling', async () => {
    const request = vi.fn().mockResolvedValueOnce(json({ secret: 'provider-echoed-secret' }, 403)).mockResolvedValueOnce(json({ secret: 'provider-echoed-secret' }, 429, { 'Retry-After': '99999' }));
    const transport = new PosTransport({ fetch: request });
    await expect(transport.request('https://connect.squareup.com/v2/payments', {})).rejects.toMatchObject({ code: 'PROVIDER_PERMISSION_DENIED', status: 422, message: expect.not.stringContaining('provider-echoed-secret') });
    await expect(transport.request('https://connect.squareup.com/v2/payments', {})).rejects.toMatchObject({ code: 'PROVIDER_RATE_LIMITED', status: 429, retryAfterSeconds: 3600 });
  });

  it('reuses Toast tokens, follows order pages, and reads labor and nested menus', async () => {
    const record = toast();
    const page = Array.from({ length: 100 }, (_, index) => ({ guid: `O${index}`, checks: [] }));
    const request = vi.fn(async (url: string, init: RequestInit) => {
      const parsed = new URL(url);
      if (parsed.pathname.includes('/authentication/')) {
        expect(JSON.parse(String(init.body))).toEqual({ clientId: 'client', clientSecret: 'toast-private-secret', userAccessType: 'TOAST_MACHINE_CLIENT' });
        return json({ token: { accessToken: 'toast-bearer-token', expiresIn: 86400 } });
      }
      expect((init.headers as Record<string, string>)['Toast-Restaurant-External-ID']).toBe('T1');
      if (parsed.pathname.includes('/orders/')) return parsed.searchParams.get('page') === '1' ? json(page) : json([{ guid: 'O100', openedDate: range.startDate, checks: [{ server: { guid: 'check-employee' }, paymentStatus: 'PAID', payments: [{ guid: 'P1', server: { guid: 'employee' }, paidDate: range.startDate, amount: 12.34, tipAmount: 2.56, paymentStatus: 'CAPTURED', refundStatus: 'PARTIAL', refund: { refundAmount: 1.25, tipRefundAmount: 0.25 }, cardType: 'private-card-detail' }] }] }]);
      if (parsed.pathname.includes('/labor/')) {
        expect(parsed.searchParams.get('includeArchived')).toBe('true');
        return json([{ guid: 'TE1', employeeReference: { guid: 'employee' }, inDate: range.startDate, declaredCashTips: 1.75, nonCashTips: 2.25, deleted: true }]);
      }
      return json({ menus: [{ menuGroups: [{ menuGroups: [{ menuItems: [{ guid: 'MI1', name: 'Tea' }] }] }] }] });
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const result = await previewPos(record, { ...range, includeLabor: true, includeCatalog: true }, { fetch: request as typeof fetch, sleep, toastBaseUrl: toastHost });
    expect(request.mock.calls.filter(call => call[0].includes('/authentication/'))).toHaveLength(1);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(result.sales[0]).toMatchObject({ amountMinor: 1234, tipMinor: 256, refundedMinor: 150, employeeId: 'employee', status: 'CAPTURED', refundStatus: 'PARTIAL' });
    expect(result.labor[0]).toMatchObject({ declaredCashTipMinor: 175, nonCashTipMinor: 225, deleted: true });
    expect(result.catalog).toEqual([{ id: 'MI1', locationId: 'T1', name: 'Tea' }]);
    expect(JSON.stringify(result)).not.toContain('private-card-detail');
    expect(JSON.stringify(result)).not.toContain('toast-bearer-token');
  });

  it('uses documented millisecond and numeric UTC offset query dates when validating Toast access', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-02T12:34:56.789Z'));
    const request = vi.fn().mockResolvedValueOnce(json({ token: { accessToken: 'toast-bearer-token', expiresIn: 86400 } })).mockResolvedValueOnce(json([]));

    await validatePosConnection(toast().credentials, { fetch: request, toastBaseUrl: toastHost });

    const url = new URL(request.mock.calls[1][0]);
    expect(url.searchParams.get('startDate')).toBe('2026-09-02T12:33:56.789+0000');
    expect(url.searchParams.get('endDate')).toBe('2026-09-02T12:34:56.789+0000');
    expect(url.search).toContain('%2B0000');
  });

  it.each([
    { input: range, start: '2026-09-01T00:00:00.000+0000', end: '2026-09-02T00:00:00.000+0000' },
    { input: { startDate: '2026-09-01T01:30:00.123+01:30', endDate: '2026-09-02T01:30:00.456+01:30' }, start: '2026-09-01T00:00:00.123+0000', end: '2026-09-02T00:00:00.456+0000' },
  ])('formats Toast order and labor query dates without changing the preview interval ($start)', async ({ input, start, end }) => {
    const request = vi.fn(async (url: string) => new URL(url).pathname.includes('/authentication/')
      ? json({ token: { accessToken: 'toast-bearer-token', expiresIn: 86400 } })
      : json([]));

    const result = await previewPos(toast(), { ...input, includeLabor: true }, { fetch: request as typeof fetch, toastBaseUrl: toastHost });

    const dataUrls = request.mock.calls.map(call => new URL(call[0])).filter(url => !url.pathname.includes('/authentication/'));
    expect(dataUrls.map(url => url.pathname)).toEqual(['/orders/v2/ordersBulk', '/labor/v1/timeEntries']);
    for (const url of dataUrls) {
      expect(url.searchParams.get('startDate')).toBe(start);
      expect(url.searchParams.get('endDate')).toBe(end);
      expect(url.search).toContain('%2B0000');
      expect(Date.parse(url.searchParams.get('startDate')!)).toBe(Date.parse(input.startDate));
      expect(Date.parse(url.searchParams.get('endDate')!)).toBe(Date.parse(input.endDate));
    }
    expect(result).toMatchObject({ startDate: input.startDate, endDate: input.endDate });
  });

  it('drops a rejected Toast token so a later attempt can reauthenticate', async () => {
    const record = toast(); record.toastToken = { accessToken: 'cached', expiresAt: Date.now() + 60000 };
    const request = vi.fn().mockResolvedValue(json({ reason: 'expired' }, 401));
    await expect(previewPos(record, range, { fetch: request, toastBaseUrl: toastHost })).rejects.toMatchObject({ code: 'PROVIDER_UNAUTHORIZED' });
    expect(request).toHaveBeenCalledTimes(1);
    expect(record.toastToken).toBeUndefined();
  });

  it('reauthenticates an expired Toast token and honors the provider lifetime', async () => {
    const record = toast(); record.toastToken = { accessToken: 'expired', expiresAt: Date.now() - 1 };
    const request = vi.fn().mockResolvedValueOnce(json({ token: { accessToken: 'replacement', expiresIn: 7200 } })).mockResolvedValueOnce(json([]));
    const before = Date.now();
    await previewPos(record, range, { fetch: request, toastBaseUrl: toastHost });
    expect(request.mock.calls[0][0]).toContain('/authentication/v1/authentication/login');
    expect(request.mock.calls[1][1].headers.Authorization).toBe('Bearer replacement');
    expect(record.toastToken?.expiresAt).toBeGreaterThanOrEqual(before + 7200_000);
    expect(record.toastToken?.expiresAt).toBeLessThanOrEqual(Date.now() + 7200_000);
  });

  it('stops a repeated Toast order page instead of duplicating or truncating data', async () => {
    const record = toast(); record.toastToken = { accessToken: 'cached', expiresAt: Date.now() + 60000 };
    const page = Array.from({ length: 100 }, (_, index) => ({ guid: `O${index}`, checks: [] }));
    const request = vi.fn().mockImplementation(async () => json(page));
    await expect(previewPos(record, range, { fetch: request, sleep: vi.fn().mockResolvedValue(undefined), toastBaseUrl: toastHost })).rejects.toMatchObject({ code: 'PROVIDER_INVALID_RESPONSE' });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed monetary data rather than producing an inaccurate zero amount', async () => {
    const request = vi.fn().mockResolvedValueOnce(json({ payments: [{ id: 'P1', created_at: range.startDate, amount_money: { currency: 'USD' } }] }));
    await expect(previewPos(square(), range, { fetch: request })).rejects.toMatchObject({ code: 'PROVIDER_INVALID_MONEY' });
  });

  it('refuses unsafe Toast API hosts before exposing credentials', async () => {
    for (const toastBaseUrl of ['http://ws-api.toasttab.com', 'https://toasttab.com.attacker.test', 'https://localhost', 'https://ws-api.toasttab.com/path', 'https://secret@ws-api.toasttab.com']) {
      const request = vi.fn();
      await expect(validatePosConnection(toast().credentials, { fetch: request, toastBaseUrl })).rejects.toMatchObject({ code: 'TOAST_HOST_INVALID' });
      expect(request).not.toHaveBeenCalled();
    }
  });

  it('rejects oversized or reversed ranges before any provider request', async () => {
    const request = vi.fn();
    await expect(previewPos(square(), { startDate: '2026-09-01T00:00:00Z', endDate: '2026-10-01T00:00:00Z' }, { fetch: request })).rejects.toMatchObject({ code: 'INVALID_DATE_RANGE' });
    await expect(previewPos(square(), { startDate: range.endDate, endDate: range.startDate }, { fetch: request })).rejects.toMatchObject({ code: 'INVALID_DATE_RANGE' });
    expect(request).not.toHaveBeenCalled();
  });
});
