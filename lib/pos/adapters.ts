import type { PosConnectInput, PosConnection, PosPreview, PosPreviewInput, PosSale, PosLaborEntry, PosCatalogItem } from './contracts';
import { PosError, PosTransport, assertRange, list, minor, money, object, text, type PosTransportOptions } from './transport';

export interface PosConnectionRecord {
  credentials: PosConnectInput;
  connection: PosConnection;
  toastToken?: { accessToken: string; expiresAt: number };
}

const MAX_PAGES = 100;
const MAX_RECORDS = 10_000;
const SQUARE_VERSION = '2026-09-16';

function squareBase(record: PosConnectionRecord): string {
  return record.connection.environment === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
}

function squareHeaders(record: PosConnectionRecord): Record<string, string> {
  if (record.credentials.provider !== 'square') throw new PosError('INVALID_PROVIDER', 'Invalid POS connection.', 400);
  return { Authorization: `Bearer ${record.credentials.accessToken}`, 'Square-Version': SQUARE_VERSION };
}

function requiredId(value: unknown): string {
  const id = text(value);
  if (!id) throw new PosError('PROVIDER_INVALID_RESPONSE', 'The POS provider returned a record without an identifier.');
  return id;
}

function startsInWindow(value: unknown, input: PosPreviewInput): boolean {
  const timestamp = Date.parse(text(value));
  if (!Number.isFinite(timestamp)) throw new PosError('PROVIDER_INVALID_RESPONSE', 'The POS provider returned an invalid record timestamp.');
  return timestamp >= Date.parse(input.startDate) && timestamp < Date.parse(input.endDate);
}

function toastDateRange(input: Pick<PosPreviewInput, 'startDate' | 'endDate'>): { startDate: string; endDate: string } {
  // Toast documents millisecond precision and a numeric offset for query timestamps.
  return {
    startDate: new Date(input.startDate).toISOString().replace(/Z$/, '+0000'),
    endDate: new Date(input.endDate).toISOString().replace(/Z$/, '+0000'),
  };
}

async function squarePages(transport: PosTransport, record: PosConnectionRecord, path: string, field: string, body?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const result: Record<string, unknown>[] = [];
  const cursors = new Set<string>();
  let cursor = '';
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(squareBase(record) + path);
    if (body === undefined && cursor) url.searchParams.set('cursor', cursor);
    const response = object(await transport.request(url.toString(), squareHeaders(record), body === undefined ? undefined : { ...body, ...(cursor ? { cursor } : {}) }));
    if (list(response.errors).length) throw new PosError('PROVIDER_INVALID_RESPONSE', 'Square could not complete this read. Check the configured scopes.');
    result.push(...list(response[field]));
    if (result.length > MAX_RECORDS) break;
    const next = text(response.cursor);
    if (!next) return result;
    if (cursors.has(next)) throw new PosError('PROVIDER_INVALID_RESPONSE', 'Square returned a repeated pagination cursor.');
    cursors.add(next);
    cursor = next;
  }
  throw new PosError('PREVIEW_TOO_LARGE', 'The POS result is too large. Choose a shorter date range.', 422);
}

async function toastToken(transport: PosTransport, record: PosConnectionRecord): Promise<string> {
  if (record.credentials.provider !== 'toast') throw new PosError('INVALID_PROVIDER', 'Invalid POS connection.', 400);
  if (record.toastToken && record.toastToken.expiresAt > Date.now() + 30_000) return record.toastToken.accessToken;
  const response = object(await transport.request(transport.toastBaseUrl() + '/authentication/v1/authentication/login', {}, {
    clientId: record.credentials.clientId,
    clientSecret: record.credentials.clientSecret,
    userAccessType: 'TOAST_MACHINE_CLIENT',
  }));
  const token = object(response.token);
  const accessToken = text(token.accessToken);
  const expiresIn = typeof token.expiresIn === 'number' ? token.expiresIn : 0;
  if (!accessToken || expiresIn <= 0 || !Number.isFinite(expiresIn)) throw new PosError('PROVIDER_INVALID_RESPONSE', 'Toast did not return a valid authentication token.');
  record.toastToken = { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
  return accessToken;
}

async function toastRequest(transport: PosTransport, record: PosConnectionRecord, locationId: string, path: string): Promise<Record<string, unknown> | unknown[]> {
  const token = await toastToken(transport, record);
  try {
    return await transport.request(transport.toastBaseUrl() + path, { Authorization: `Bearer ${token}`, 'Toast-Restaurant-External-ID': locationId });
  } catch (error) {
    // A rejected token must never be reused by later requests.
    if (error instanceof PosError && error.code === 'PROVIDER_UNAUTHORIZED') record.toastToken = undefined;
    throw error;
  }
}

async function toastOrders(transport: PosTransport, record: PosConnectionRecord, locationId: string, input: PosPreviewInput): Promise<Record<string, unknown>[]> {
  const result = new Map<string, Record<string, unknown>>();
  const pageSignatures = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    await transport.paceToastOrders();
    const query = new URLSearchParams({ ...toastDateRange(input), page: String(page), pageSize: '100' });
    const response = await toastRequest(transport, record, locationId, '/orders/v2/ordersBulk?' + query);
    if (!Array.isArray(response)) throw new PosError('PROVIDER_INVALID_RESPONSE', 'Toast returned invalid order data.');
    const orders = list(response);
    const signature = orders.map(order => requiredId(order.guid)).join('|');
    if (orders.length && pageSignatures.has(signature)) throw new PosError('PROVIDER_INVALID_RESPONSE', 'Toast returned a repeated order page.');
    pageSignatures.add(signature);
    for (const order of orders) result.set(requiredId(order.guid), order);
    if (result.size > MAX_RECORDS) break;
    if (orders.length < 100) return [...result.values()];
  }
  throw new PosError('PREVIEW_TOO_LARGE', 'The POS result is too large. Choose a shorter date range.', 422);
}

export async function validatePosConnection(input: PosConnectInput, options: PosTransportOptions = {}): Promise<PosConnectionRecord> {
  const transport = new PosTransport(options);
  const record: PosConnectionRecord = {
    credentials: input,
    connection: { provider: input.provider, environment: input.provider === 'square' ? input.environment : 'production', status: 'validated', locations: [], validatedAt: new Date().toISOString(), warnings: [] },
  };
  if (input.provider === 'square') {
    const response = object(await transport.request(squareBase(record) + '/v2/locations', squareHeaders(record)));
    const available = list(response.locations).filter(location => location.status === 'ACTIVE');
    const selected = input.locationIds?.length ? input.locationIds : available.map(location => requiredId(location.id));
    if (!selected.length || selected.length > 20 || selected.some(id => !available.some(location => location.id === id))) {
      throw new PosError('INVALID_LOCATIONS', 'Select between one and twenty active Square locations accessible to this token.', 400);
    }
    record.connection.locations = available.filter(location => selected.includes(text(location.id))).map(location => ({ id: requiredId(location.id), name: text(location.name) || text(location.id), currency: text(location.currency), timeZone: text(location.timezone) || undefined }));
    for (const location of record.connection.locations) {
      const query = new URLSearchParams({ location_id: location.id, limit: '1' });
      await transport.request(squareBase(record) + '/v2/payments?' + query, squareHeaders(record));
    }
    record.credentials = { ...input, locationIds: selected };
    record.connection.warnings.push('Token setup requires MERCHANT_PROFILE_READ and PAYMENTS_READ. Add TIMECARDS_READ for labor and ITEMS_READ for catalog. OAuth tokens expire; reconnect when they expire. OAuth onboarding and automatic refresh are not enabled.');
  } else {
    if (!input.locationIds.length || input.locationIds.length > 20) throw new PosError('INVALID_LOCATIONS', 'Configure between one and twenty Toast restaurant GUIDs.', 400);
    const now = Date.now();
    const range = { startDate: new Date(now - 60_000).toISOString(), endDate: new Date(now).toISOString() };
    for (const id of input.locationIds) {
      const query = new URLSearchParams({ ...toastDateRange(range), page: '1', pageSize: '1' });
      const response = await toastRequest(transport, record, id, '/orders/v2/ordersBulk?' + query);
      if (!Array.isArray(response)) throw new PosError('PROVIDER_INVALID_RESPONSE', 'Toast returned invalid order data.');
    }
    record.connection.locations = input.locationIds.map(id => ({ id, name: id, currency: input.currency }));
    record.connection.warnings.push('Toast Standard API access requires RMS Essentials or higher and Manage Integrations permission at every location. It is read-only and has no sandbox. Configure orders:read; labor:read and menus:read enable optional preview sections.');
  }
  return record;
}

export async function previewPos(record: PosConnectionRecord, input: PosPreviewInput, options: PosTransportOptions = {}): Promise<PosPreview> {
  assertRange(input);
  const transport = new PosTransport(options);
  const sales: PosSale[] = [];
  const labor: PosLaborEntry[] = [];
  const catalog: PosCatalogItem[] = [];
  const warnings: string[] = ['Preview only. Review employee mapping, refunds, gratuities and tip withholding before importing any payroll data.'];
  if (record.credentials.provider === 'square') {
    for (const location of record.connection.locations) {
      const query = new URLSearchParams({ location_id: location.id, begin_time: input.startDate, end_time: input.endDate, limit: '100' });
      const payments = await squarePages(transport, record, '/v2/payments?' + query, 'payments');
      sales.push(...payments.filter(payment => startsInWindow(payment.created_at, input)).map(payment => ({ id: requiredId(payment.id), locationId: location.id, orderId: text(payment.order_id) || undefined, employeeId: text(payment.team_member_id) || undefined, occurredAt: text(payment.created_at), currency: text(object(payment.amount_money).currency) || location.currency, amountMinor: minor(object(payment.amount_money).amount), tipMinor: money(payment.tip_money), refundedMinor: money(payment.refunded_money), status: text(payment.status) })));
      if (input.includeLabor) {
        const timecards = await squarePages(transport, record, '/v2/labor/timecards/search', 'timecards', { limit: 100, query: { filter: { location_ids: [location.id], start: { start_at: input.startDate, end_at: input.endDate } } } });
        labor.push(...timecards.filter(entry => startsInWindow(entry.start_at, input)).map(entry => ({ id: requiredId(entry.id), locationId: location.id, employeeId: text(entry.team_member_id), startedAt: text(entry.start_at), endedAt: text(entry.end_at) || undefined, declaredCashTipMinor: money(entry.declared_cash_tip_money), currency: text(object(entry.declared_cash_tip_money).currency) || location.currency, deleted: false })));
      }
    }
    if (input.includeCatalog) {
      const items = await squarePages(transport, record, '/v2/catalog/list?types=ITEM', 'objects');
      catalog.push(...items.map(item => ({ id: requiredId(item.id), name: text(object(item.item_data).name) || text(item.id) })));
      warnings.push('Square catalog preview lists current items; deleted items and historical catalog versions are not included.');
    }
    warnings.push('Square payment dates are creation dates. Offline payments can arrive late. Re-read original payment date ranges for later tip/refund changes; overlapping current ranges alone do not recover older changes. Labor includes timecards that started in the selected range.');
  } else {
    for (const location of record.connection.locations) {
      const orders = await toastOrders(transport, record, location.id, input);
      for (const order of orders) for (const check of list(order.checks)) for (const payment of list(check.payments)) {
        const refund = object(payment.refund);
        sales.push({ id: requiredId(payment.guid), locationId: location.id, orderId: requiredId(order.guid), employeeId: text(object(payment.server).guid) || text(object(check.server).guid) || text(object(order.server).guid) || undefined, occurredAt: text(payment.paidDate) || text(order.openedDate), currency: location.currency, amountMinor: minor(payment.amount, true), tipMinor: minor(payment.tipAmount, true), refundedMinor: minor(refund.refundAmount ?? 0, true) + minor(refund.tipRefundAmount ?? 0, true), status: order.voided || check.voided ? 'VOIDED' : text(payment.paymentStatus) || text(check.paymentStatus), refundStatus: text(payment.refundStatus) || undefined });
      }
      if (input.includeLabor) {
        const query = new URLSearchParams({ ...toastDateRange(input), includeArchived: 'true', includeMissedBreaks: 'true' });
        const response = await toastRequest(transport, record, location.id, '/labor/v1/timeEntries?' + query);
        if (!Array.isArray(response)) throw new PosError('PROVIDER_INVALID_RESPONSE', 'Toast returned invalid labor data.');
        labor.push(...list(response).filter(entry => startsInWindow(entry.inDate, input)).map(entry => ({ id: requiredId(entry.guid), locationId: location.id, employeeId: text(object(entry.employeeReference).guid), startedAt: text(entry.inDate), endedAt: text(entry.outDate) || undefined, declaredCashTipMinor: minor(entry.declaredCashTips ?? 0, true), nonCashTipMinor: minor(entry.nonCashTips ?? 0, true), currency: location.currency, deleted: entry.deleted === true })));
      }
      if (input.includeCatalog) {
        const response = object(await toastRequest(transport, record, location.id, '/menus/v2/menus'));
        const collect = (entries: Record<string, unknown>[]) => {
          for (const entry of entries) {
            for (const item of list(entry.menuItems)) catalog.push({ id: requiredId(item.guid), locationId: location.id, name: text(item.name) || text(item.guid) });
            collect(list(entry.menuGroups));
          }
        };
        collect(list(response.menus));
      }
    }
    warnings.push('Toast order windows use modified dates, so payments may have been paid outside the window. Restaurant currency is supplied during setup. Labor entries use clock-in dates. These records are not an accounting report.');
  }
  if (sales.length + labor.length + catalog.length > MAX_RECORDS) throw new PosError('PREVIEW_TOO_LARGE', 'The POS result is too large. Choose a shorter date range.', 422);
  return { provider: record.connection.provider, startDate: input.startDate, endDate: input.endDate, fetchedAt: new Date().toISOString(), sales, labor, catalog, warnings, previewOnly: true };
}
