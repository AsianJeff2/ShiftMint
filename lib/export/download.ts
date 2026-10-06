import { toCsv } from './csv';
import type { ExportMetadata } from './contracts';

function download(content: string, filename: string, mediaType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the URL available until the browser starts consuming the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(value: unknown, filename: string): void {
  download(JSON.stringify(value, null, 2), filename, 'application/json');
}

export function downloadExport(rows: Record<string, unknown>[], type: string, format: 'csv' | 'json', metadata?: ExportMetadata): void {
  const disclosures = metadata ? { ...(metadata.taxTreatment ? { taxTreatment: metadata.taxTreatment } : {}), warnings: metadata.warnings ?? [] } : undefined;
  if (format === 'json') {
    downloadJson(disclosures ? { ...disclosures, data: rows } : rows, `shiftmint-${type}-export.json`);
    return;
  }
  const fields = disclosures ? { ...(disclosures.taxTreatment ? { taxTreatment: disclosures.taxTreatment } : {}), exportWarnings: disclosures.warnings.join(' | ') } : undefined;
  const records = fields ? (rows.length ? rows : [{}]).map(row => ({ ...row, ...fields })) : rows;
  download('\uFEFF' + toCsv(records), `shiftmint-${type}-export.csv`, 'text/csv;charset=utf-8');
}
