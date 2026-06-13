import { describe, expect, it } from 'vitest';

import { mapRows, parseCsv, parseCsvSource } from './parse-table';

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

describe('parseCsvSource (true file row numbers — R3-import-4)', () => {
  it('numbers rows 1-based and keeps numbers across dropped blank lines', () => {
    const out = parseCsvSource('first_name\nA\n   ,\nB');
    expect(out.map((r) => r.sourceRow)).toEqual([1, 2, 4]);
    expect(out.map((r) => r.cells[0])).toEqual(['first_name', 'A', 'B']);
  });

  it('counts lines inside quoted multi-line fields toward the next row', () => {
    const out = parseCsvSource('h\n"l1\nl2",x\nlast');
    expect(out.map((r) => r.sourceRow)).toEqual([1, 2, 4]);
  });
});

describe('mapRows', () => {
  it('returns empty for fewer than 2 rows (need header + data)', () => {
    expect(mapRows([]).rows).toEqual([]);
    expect(mapRows([['name']]).rows).toEqual([]);
  });

  it('maps Hebrew aliases to canonical fields', () => {
    expect(
      mapRows([
        ['שם פרטי', 'שם משפחה', 'תז', 'טלפון'],
        ['משה', 'כהן', '123456789', '0501234567'],
      ]).rows,
    ).toEqual([
      {
        first_name: 'משה',
        last_name: 'כהן',
        national_id: '123456789',
        phone: '0501234567',
      },
    ]);
  });

  it('maps a typographic gershayim header (ת״ז, U+05F4) to national_id', () => {
    const out = mapRows([
      ['שם פרטי', 'ת״ז'],
      ['דנה', '123456782'],
    ]);
    expect(out.rows).toEqual([{ first_name: 'דנה', national_id: '123456782' }]);
    expect(out.unmappedHeaders).toEqual([]);
  });

  it('maps English aliases (case- and whitespace-insensitive)', () => {
    expect(
      mapRows([
        ['First Name', 'LAST_NAME', 'Email'],
        ['Avi', 'Levi', 'avi@example.com'],
      ]).rows,
    ).toEqual([{ first_name: 'Avi', last_name: 'Levi', email: 'avi@example.com' }]);
  });

  it('drops unrecognized columns AND reports them', () => {
    const out = mapRows([
      ['first_name', 'something_weird', 'last_name'],
      ['Dana', 'X', 'Mor'],
    ]);
    expect(out.rows).toEqual([{ first_name: 'Dana', last_name: 'Mor' }]);
    expect(out.unmappedHeaders).toEqual(['something_weird']);
  });

  it('drops blank cells (keeps rows partial-friendly)', () => {
    expect(
      mapRows([
        ['first_name', 'last_name', 'phone'],
        ['Dana', '', '0501112222'],
      ]).rows,
    ).toEqual([{ first_name: 'Dana', phone: '0501112222' }]);
  });

  it('trims whitespace around cell values', () => {
    expect(mapRows([['first_name'], ['  Dana  ']]).rows).toEqual([{ first_name: 'Dana' }]);
  });

  it('handles header punctuation (dots, quotes) via the normalizer', () => {
    expect(
      mapRows([
        ['"First.Name"', "'Last Name'"],
        ['Dana', 'Mor'],
      ]).rows,
    ).toEqual([{ first_name: 'Dana', last_name: 'Mor' }]);
  });

  it('emits one row per data line', () => {
    const out = mapRows([['first_name'], ['A'], ['B'], ['C']]).rows;
    expect(out).toHaveLength(3);
    expect(out.map((r) => r.first_name)).toEqual(['A', 'B', 'C']);
  });
});
