import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('payroll CSV export', () => {
  it('preserves quotes, newlines, nested details and columns appearing in later rows', () => {
    expect(toCsv([{ name: 'A, "B"\nC', entries: [{ amount: 20 }] }, { employee: 'Second' }])).toBe(
      '"name","entries","employee"\r\n"A, ""B""\nC","[{""amount"":20}]",""\r\n"","","Second"',
    );
  });
  it('neutralizes spreadsheet formulas while preserving numeric deductions', () => {
    for (const formula of ['=HYPERLINK("x")', ' +SUM(1,2)', '-2+3', '@SUM(A1)', '\t=1']) {
      expect(csvCell(formula)).toMatch(/^"'/);
    }
    expect(csvCell(-20)).toBe('"-20"');
  });
});
