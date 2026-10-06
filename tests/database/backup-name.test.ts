import { describe, expect, it } from 'vitest';
import { isSafeBackupFilename, normalizeCustomBackupName } from '../../lib/database/backup-name';

describe('backup name contract', () => {
  it('allows automatic naming and preserves safe existing filenames', () => {
    expect(normalizeCustomBackupName('  ')).toBeUndefined();
    expect(normalizeCustomBackupName(' before-payroll ')).toBe('before-payroll.db');
    expect(normalizeCustomBackupName('before-payroll.db')).toBe('before-payroll.db');
    expect(isSafeBackupFilename('snapshot.2026.db')).toBe(true);
  });
  it.each(['plain-label', 'snapshot.sqlite', '../snapshot.db', 'snapshot..db', 'C:\\snapshot.db', 'CON.db', 'nul.db', 'LPT1.db', `${'a'.repeat(128)}.db`, null, 123])('rejects an unsafe server filename %s', filename => {
    expect(isSafeBackupFilename(filename)).toBe(false);
  });
});
