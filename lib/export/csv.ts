export function csvCell(value: unknown): string {
  let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  return [headers.map(csvCell).join(','), ...rows.map(row => headers.map(header => csvCell(row[header])).join(','))].join('\r\n');
}
