import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import apiClient from '@/lib/api-client';
import { errorMessage } from '@/lib/error-handling';
import { downloadJson } from '@/lib/export/download';
import type { PosConnectInput, PosConnection, PosEnvironment, PosPreview, PosProvider } from '@/lib/pos/contracts';

interface IntegrationsSettingsProps { data?: unknown; onChange?: (data: unknown) => void }
type ToastCurrency = Extract<PosConnectInput, { provider: 'toast' }>['currency'];
const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

function formatMoney(amount: number, currency: string): string {
  try {
    const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(amount / 10 ** digits);
  } catch { return `${amount} minor units (${currency})`; }
}

export const IntegrationsSettings: React.FC<IntegrationsSettingsProps> = () => {
  const [provider, setProvider] = useState<PosProvider>('square');
  const [environment, setEnvironment] = useState<PosEnvironment>('sandbox');
  const [accessToken, setAccessToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [locationIds, setLocationIds] = useState('');
  const [currency, setCurrency] = useState<ToastCurrency>('USD');
  const [connections, setConnections] = useState<PosConnection[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<PosPreview | null>(null);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [includeLabor, setIncludeLabor] = useState(false);
  const [includeCatalog, setIncludeCatalog] = useState(false);
  const connection = connections.find(item => item.provider === provider);
  const reload = async () => { const result = await apiClient.getPosConnections(); setConnections(result.data ?? []); };
  useEffect(() => { void reload().catch(err => setError(errorMessage(err, 'Could not load POS settings. Check your connection and sign in again.'))); }, []);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); }
    catch (err) {
      setError(errorMessage(err));
      // Credential rejection can change server status even though the read failed.
      try { await reload(); } catch { /* Keep the original action's error visible. */ }
    }
    finally { setBusy(false); }
  };
  const connect = () => run(async () => {
    const ids = [...new Set(locationIds.split(/[\s,]+/).filter(Boolean))];
    const input: PosConnectInput = provider === 'square'
      ? { provider, environment, accessToken, ...(ids.length ? { locationIds: ids } : {}) }
      : { provider, clientId, clientSecret, locationIds: ids, currency };
    await apiClient.connectPos(input);
    setAccessToken(''); setClientSecret(''); setPreview(null);
    await reload(); setNotice('Provider credentials and location access validated.');
  });
  const readPreview = () => run(async () => {
    const result = await apiClient.previewPos(provider, { startDate: new Date(startDate + 'T00:00:00Z').toISOString(), endDate: new Date(endDate + 'T00:00:00Z').toISOString(), includeLabor, includeCatalog });
    setPreview(result.data ?? null); await reload();
  });
  const disconnect = () => run(async () => {
    await apiClient.disconnectPos(provider); setPreview(null); await reload();
    setNotice('Credentials removed from ShiftMint. Revoke provider access in its dashboard if needed.');
  });
  const download = () => {
    if (!preview) return;
    downloadJson(preview, `shiftmint-${provider}-preview.json`);
  };

  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>POS connections</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Owners and managers can read provider data for review. Credentials are encrypted on the server and never returned to this page.</p>
      <div className="space-y-2"><Label htmlFor="pos-provider">Provider</Label><select id="pos-provider" className={selectClass} disabled={busy} value={provider} onChange={event => { setProvider(event.target.value as PosProvider); setAccessToken(''); setClientSecret(''); setLocationIds(''); setPreview(null); setError(''); setNotice(''); }}><option value="square">Square</option><option value="toast">Toast</option></select></div>
      {connection && <div className="rounded-md border p-3 space-y-2"><Badge variant="outline">{connection.status === 'validated' ? 'Validated' : 'Needs attention'}</Badge><p className="text-sm">{connection.environment} · {connection.locations.length} location(s) · Last validation: {new Date(connection.validatedAt).toLocaleString()}</p>{connection.warnings.map((warning, index) => <p key={index} className="text-sm text-muted-foreground">{warning}</p>)}<Button variant="outline" disabled={busy} onClick={disconnect}>Disconnect {provider === 'square' ? 'Square' : 'Toast'}</Button></div>}
      {provider === 'square' ? <>
        <div className="space-y-2"><Label htmlFor="square-environment">Square environment</Label><select id="square-environment" className={selectClass} value={environment} disabled={busy} onChange={event => setEnvironment(event.target.value as PosEnvironment)}><option value="sandbox">Sandbox</option><option value="production">Production</option></select></div>
        <div className="space-y-2"><Label htmlFor="square-token">Square merchant access token</Label><Input id="square-token" type="password" autoComplete="off" value={accessToken} disabled={busy} onChange={event => setAccessToken(event.target.value)} /></div>
        <p className="text-sm text-muted-foreground">Use a token issued for your merchant. Required scopes: MERCHANT_PROFILE_READ and PAYMENTS_READ. Labor requires TIMECARDS_READ; catalog requires ITEMS_READ. OAuth onboarding and automatic token refresh are not enabled. Reconnect when an OAuth token expires.</p>
      </> : <>
        <div className="space-y-2"><Label htmlFor="toast-client-id">Toast API client ID</Label><Input id="toast-client-id" autoComplete="off" value={clientId} disabled={busy} onChange={event => setClientId(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="toast-client-secret">Toast API client secret</Label><Input id="toast-client-secret" type="password" autoComplete="off" value={clientSecret} disabled={busy} onChange={event => setClientSecret(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="toast-currency">Restaurant currency</Label><select id="toast-currency" className={selectClass} disabled={busy} value={currency} onChange={event => setCurrency(event.target.value as ToastCurrency)}>{['USD', 'CAD', 'GBP', 'EUR', 'AUD'].map(value => <option key={value} value={value}>{value}</option>)}</select></div>
        <p className="text-sm text-muted-foreground">Toast Standard API access is read-only and requires RMS Essentials or higher and Manage Integrations permission at each location. It has no sandbox. Use orders:read, plus labor:read and menus:read for optional sections. The server administrator must configure the API Access URL from Toast Web.</p>
      </>}
      <div className="space-y-2"><Label htmlFor="pos-locations">{provider === 'toast' ? 'Toast restaurant GUIDs (required)' : 'Square location IDs (optional; blank selects all active locations)'}</Label><Input id="pos-locations" value={locationIds} disabled={busy} placeholder="Separate locations with commas" onChange={event => setLocationIds(event.target.value)} /></div>
      <Button disabled={busy || (provider === 'square' ? !accessToken.trim() : !clientId.trim() || !clientSecret.trim() || !locationIds.trim())} onClick={connect}>{busy ? 'Working...' : 'Validate and save connection'}</Button>
      <p className="text-sm text-muted-foreground">Verona POS support is not implemented. An approved API or export contract is required before a connector can be added. <a className="underline" href="https://doc.veronapos.com/en" target="_blank" rel="noopener noreferrer">Verona POS documentation</a></p>
    </CardContent></Card>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {notice && <Alert><AlertDescription>{notice}</AlertDescription></Alert>}
    {connection && <Card><CardHeader><CardTitle>Read a data preview</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Choose up to 28 days. Dates use UTC midnight; the end date is exclusive. Optional sections require additional provider scopes. No payroll data is imported.</p>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="pos-start-date">Start date</Label><Input id="pos-start-date" type="date" value={startDate} disabled={busy} onChange={event => setStartDate(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="pos-end-date">End date (exclusive)</Label><Input id="pos-end-date" type="date" value={endDate} disabled={busy} onChange={event => setEndDate(event.target.value)} /></div></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeLabor} disabled={busy} onChange={event => setIncludeLabor(event.target.checked)} />Include labor and declared cash tips</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeCatalog} disabled={busy} onChange={event => setIncludeCatalog(event.target.checked)} />Include current menu/catalog items</label>
      <Button disabled={busy || !startDate || !endDate} onClick={readPreview}>{busy ? 'Working...' : 'Fetch preview'}</Button>
      {preview && <div className="space-y-3"><p className="text-sm">{preview.sales.length} payments · {preview.labor.length} labor entries · {preview.catalog.length} menu/catalog items</p>{preview.warnings.map((warning, index) => <p key={index} className="text-sm text-muted-foreground">{warning}</p>)}<Button variant="outline" onClick={download}>Download preview JSON</Button><div className="overflow-x-auto"><table className="w-full text-sm"><caption className="text-left text-muted-foreground py-2">First 50 payments. Amount excludes tips.</caption><thead><tr><th className="text-left p-2">Payment</th><th className="text-left p-2">Date</th><th className="text-right p-2">Amount</th><th className="text-right p-2">Tip</th><th className="text-left p-2">Status</th></tr></thead><tbody>{preview.sales.slice(0, 50).map(sale => <tr key={`${sale.locationId}:${sale.id}`} className="border-t"><td className="p-2">{sale.id}</td><td className="p-2">{sale.occurredAt}</td><td className="p-2 text-right">{formatMoney(sale.amountMinor, sale.currency)}</td><td className="p-2 text-right">{formatMoney(sale.tipMinor, sale.currency)}</td><td className="p-2">{sale.status}</td></tr>)}</tbody></table></div></div>}
    </CardContent></Card>}
  </div>;
};
