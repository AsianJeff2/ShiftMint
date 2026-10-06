// @vitest-environment jsdom
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadExport } from './download';

let blobs: NodeBlob[];
const revoke = vi.fn();
beforeEach(() => {
  blobs = [];
  vi.useFakeTimers();
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal('URL', { createObjectURL: vi.fn((blob: NodeBlob) => { blobs.push(blob); return 'blob:export'; }), revokeObjectURL: revoke });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  revoke.mockClear();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('downloaded export disclosure', () => {
  it('retains estimate metadata and server warnings with JSON records', async () => {
    downloadExport([{ summary: { totalTaxes: 22 }, employee: 'Zoë' }], 'comprehensive', 'json', { taxTreatment: 'estimate', warnings: ['Review withholding before filing or paying.'] });
    expect(JSON.parse(await blobs[0].text())).toEqual({ taxTreatment: 'estimate', warnings: ['Review withholding before filing or paying.'], data: [{ summary: { totalTaxes: 22 }, employee: 'Zoë' }] });
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith('blob:export');
  });
  it('includes warnings in Excel CSV with a UTF-8 BOM, even when no records exist', async () => {
    downloadExport([], 'payroll', 'csv', { taxTreatment: 'estimate', warnings: ['Review cash tips already received.'] });
    const content = await blobs[0].text();
    expect((await blobs[0].arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect(new Uint8Array(await blobs[0].arrayBuffer()).slice(0, 3)).toEqual(new Uint8Array([239, 187, 191]));
    expect(content).toContain('taxTreatment');
    expect(content).toContain('Review cash tips already received.');
  });
});
