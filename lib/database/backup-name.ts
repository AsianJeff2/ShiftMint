/** Backup names are shared by browser labels and the server filename boundary. */
export function isSafeBackupFilename(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 128 || value.includes('..')) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.db$/.test(value)) return false;
  // Windows devices remain reserved even when followed by an extension.
  return !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value);
}

export function normalizeCustomBackupName(label: string): string | undefined {
  const value = label.trim();
  if (!value) return undefined;
  const filename = value.endsWith('.db') ? value : value.includes('.') ? value : `${value}.db`;
  if (!isSafeBackupFilename(filename)) {
    throw new Error('Use a name with letters, numbers, hyphens or underscores, with an optional .db extension. Paths and other file extensions are not allowed.');
  }
  return filename;
}
