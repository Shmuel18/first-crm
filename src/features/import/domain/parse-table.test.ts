import { describe, expect, it } from 'vitest';

import { mapRows, parseCsv } from './parse-table';

describe('parseCsv', () => {
  it('splits a simple comma-separated row', () => {
    expect(parseCsv('a,b,c')).toEqual([['a', 'b', 'c']]);
  });

  it('splits multiple rows on LF', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('normalizes CRLF and lone CR to LF', () => {
    expect(parseCsv('a,b\r\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(parseCsv('a,b\rc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('keeps commas inside double-quoted fields', () => {
    expect(parseCsv('"Smith, John",30')).toEqual([['Smith, John', '30']]);
  });

  it('keeps newlines inside double-quoted fields', () => {
    expect(parseCsv('"line1\nline2",b')).toEqual([['line1\nline2', 'b']]);
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    // CSV escape: "" inside a quoted field is a literal "
    expect(parseCsv('"he said ""hi""",1')).toEqual([['he said "hi"', '1']]);
  });

  it('drops rows that are entirely whitespace / empty', () => {
    expect(parseCsv('a,b\n   ,\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('preserves the last row even without a trailing newline', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('returns empty for a blank input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('mapRows', () => {
  it('returns empty for fewer than 2 rows (need header + data)', () => {
    expect(mapRows([])).toEqual([]);
    expect(mapRows([['name']])).toEqual([]);
  });

  it('maps Hebrew aliases to canonical fields', () => {
    expect(
      mapRows([
        ['שם פרטי', 'שם משפחה', 'תז', 'טלפון'],
        ['משה', 'כהן', '123456789', '0501234567'],
      ]),
    ).toEqual([
      {
        first_name: 'משה',
        last_name: 'כהן',
        national_id: '123456789',
        phone: '0501234567',
      },
    ]);
  });

  it('maps English aliases (case- and whitespace-insensitive)', () => {
    expect(
      mapRows([
        ['First Name', 'LAST_NAME', 'Email'],
        ['Avi', 'Levi', 'avi@example.com'],
      ]),
    ).toEqual([{ first_name: 'Avi', last_name: 'Levi', email: 'avi@example.com' }]);
  });

  it('ignores unrecognized columns', () => {
    expect(
      mapRows([
        ['first_name', 'something_weird', 'last_name'],
        ['Dana', 'X', 'Mor'],
      ]),
    ).toEqual([{ first_name: 'Dana', last_name: 'Mor' }]);
  });

  it('drops blank cells (keeps rows partial-friendly)', () => {
    expect(
      mapRows([
        ['first_name', 'last_name', 'phone'],
        ['Dana', '', '0501112222'],
      ]),
    ).toEqual([{ first_name: 'Dana', phone: '0501112222' }]);
  });

  it('trims whitespace around cell values', () => {
    expect(
      mapRows([
        ['first_name'],
        ['  Dana  '],
      ]),
    ).toEqual([{ first_name: 'Dana' }]);
  });

  it('handles header punctuation (dots, quotes) via the normalizer', () => {
    expect(
      mapRows([
        ['"First.Name"', "'Last Name'"],
        ['Dana', 'Mor'],
      ]),
    ).toEqual([{ first_name: 'Dana', last_name: 'Mor' }]);
  });

  it('emits one row per data line', () => {
    const out = mapRows([
      ['first_name'],
      ['A'],
      ['B'],
      ['C'],
    ]);
    expect(out).toHaveLength(3);
    expect(out.map((r) => r.first_name)).toEqual(['A', 'B', 'C']);
  });
});
