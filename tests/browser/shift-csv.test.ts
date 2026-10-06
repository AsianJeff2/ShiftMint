import { describe, expect, it } from 'vitest';
import { parseShiftCsv } from '../../lib/shifts/csv';

const header = 'Employee Name,Start Date,End Date,Type,Hourly Rate,Notes';
describe('strict shift CSV input', () => {
  it.each([['Work', 'work', 'completed'], ['Break', 'break', 'break']])('normalizes template %s into the server enum', (input, type, status) => {
    const result = parseShiftCsv(`${header}\nAda Test,2026-09-06T09:00:00-07:00,2026-09-06T17:00:00-07:00,${input},35,verified`);
    expect(result.errors).toEqual([]);
    expect(result.data[0]).toMatchObject({ type, status });
  });
  it('rejects an unsupported type before preview rather than passing an invalid server enum', () => {
    const result = parseShiftCsv(`${header}\nAda Test,2026-09-06T09:00:00Z,2026-09-06T17:00:00Z,Training,35,verified`);
    expect(result.data).toEqual([]);
    expect(result.errors[0]).toContain('Unsupported shift type');
  });
  it('normalizes explicit offsets to the same instants independently of the host', () => {
    const result = parseShiftCsv(`${header}\nAda Test,2026-10-05T09:00:00-04:00,2026-10-05T17:00:00-04:00,Work,20,verified`);
    expect(result.errors).toEqual([]);
    expect(result.data).toEqual([expect.objectContaining({ employeeName: 'Ada Test', startTime: '2026-10-05T13:00:00.000Z', endTime: '2026-10-05T21:00:00.000Z', status: 'completed', hourlyRate: '20' })]);
  });
  it.each(['', 'yesterday 9am', '05/10/2026 09:00', '2026-10-05T09:00:00', '2026-02-30T09:00:00Z'])('rejects missing, ambiguous or invalid start %j instead of inventing a date', start => {
    const result = parseShiftCsv(`${header}\nAda Test,${start},2026-10-05T17:00:00Z,Work,20,missing start`);
    expect(result.data).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });
  it.each(['not-a-date', '2026-10-05T08:00:00Z', '2026-10-05T09:00:00Z'])('rejects invalid or reversed end %s rather than creating an open shift', end => {
    const result = parseShiftCsv(`${header}\nAda Test,2026-10-05T09:00:00Z,${end},Work,20,invalid end`);
    expect(result.data).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });
  it('skips both single-cell and padded employee group headings without creating shifts', () => {
    const result = parseShiftCsv(`${header}\nAda Test\n,2026-10-05T09:00:00Z,2026-10-05T17:00:00Z,Work,20,one\nGrace Test,,,,,\n,2026-10-06T09:00:00Z,2026-10-06T17:00:00Z,Work,30,two`);
    expect(result.errors).toEqual([]);
    expect(result.data.map(row => row.employeeName)).toEqual(['Ada Test', 'Grace Test']);
  });
  it('handles quoted names, commas, quotes and multiline notes without shifting columns', () => {
    const result = parseShiftCsv(`${header}\n"Test, Ada",2026-10-05T09:00:00Z,2026-10-05T17:00:00Z,Work,20,"first line\nsecond ""quoted"" line"`);
    expect(result.errors).toEqual([]);
    expect(result.data[0]).toMatchObject({ employeeName: 'Test, Ada', notes: 'first line\nsecond "quoted" line' });
  });
  it('does not reinterpret apostrophes in employee names as quotes', () => {
    expect(parseShiftCsv(`${header}\nAda O'Neil,2026-10-05T09:00:00Z,2026-10-05T17:00:00Z,Work,20,ok`).data[0].employeeName).toBe("Ada O'Neil");
  });
  it.each([';', '\t', '|'])('supports delimiter %j and BOM', delimiter => {
    const result = parseShiftCsv(`\uFEFF${header.replaceAll(',', delimiter)}\nAda Test${delimiter}2026-10-05T09:00:00Z${delimiter}2026-10-05T17:00:00Z${delimiter}Work${delimiter}20${delimiter}ok`);
    expect(result.errors).toEqual([]);
    expect(result.data).toHaveLength(1);
  });
  it('rejects ragged and invalid financial rows and retains valid break timestamps', () => {
    const result = parseShiftCsv(`${header}\nAda Test,2026-10-05T09:00:00Z\nAda Test,2026-10-05T09:00:00Z,2026-10-05T17:00:00Z,Work,20oops,bad\nAda Test,2026-10-05T13:00:00Z,2026-10-05T13:30:00Z,Break,0,verified`);
    expect(result.errors).toHaveLength(2);
    expect(result.data).toEqual([expect.objectContaining({ status: 'break', jobCode: 'break', startTime: '2026-10-05T13:00:00.000Z', endTime: '2026-10-05T13:30:00.000Z' })]);
  });
  it('allows a verified open shift without pretending it completed', () => {
    expect(parseShiftCsv(`${header}\nAda Test,2026-10-05T09:00:00Z,,Work,20,open`).data[0].status).toBe('active');
  });
  it('rejects unterminated quoted fields', () => {
    expect(() => parseShiftCsv(`${header}\n"Ada,2026-10-05T09:00:00Z`)).toThrow('unterminated');
  });
  it('rejects duplicate alias columns rather than overwriting a provided timestamp', () => {
    expect(() => parseShiftCsv('Employee Name,Start Date,Start Time\nAda Test,2026-10-05T09:00:00Z,2026-10-06T09:00:00Z')).toThrow('duplicate columns');
  });
});
