import { describe, expect, it } from 'vitest';

import { validateAndNormalizeRows } from './validate-rows';

describe('validateAndNormalizeRows (R3-import-1)', () => {
  it('normalizes Israeli phones to canonical form and lowercases emails', () => {
    const { rows, errors } = validateAndNormalizeRows([
      {
        first_name: 'משה',
        last_name: 'כהן',
        phone: '+972-50-123-4567',
        email: 'Moshe.Cohen@Example.COM',
        national_id: '123456782',
      },
    ]);
    expect(errors).toEqual([]);
    expect(rows[0]?.phone).toBe('0501234567');
    expect(rows[0]?.email).toBe('moshe.cohen@example.com');
    expect(rows[0]?.national_id).toBe('123456782');
  });

  it('strips invisible bidi characters from names', () => {
    const RLM = String.fromCharCode(0x200f);
    const { rows, errors } = validateAndNormalizeRows([
      { first_name: `דנה${RLM}`, last_name: 'לוי' },
    ]);
    expect(errors).toEqual([]);
    expect(rows[0]?.first_name).toBe('דנה');
  });

  it('rejects an invalid phone with a structured 1-based row error', () => {
    const { rows, errors } = validateAndNormalizeRows([
      { first_name: 'a', last_name: 'b' },
      { first_name: 'c', phone: '0612345678' },
    ]);
    // Valid rows are still returned — the ACTION enforces all-or-nothing by
    // returning the errors without ever calling the RPC.
    expect(rows).toHaveLength(1);
    expect(errors).toEqual([{ row: 2, code: 'invalid_phone' }]);
  });

  it('rejects garbage national IDs and emails with field-specific codes', () => {
    const { errors } = validateAndNormalizeRows([
      { first_name: 'a', national_id: '12!@#' },
      { first_name: 'b', email: 'not-an-email' },
      { first_name: 'c', advisor_email: 'also-not-an-email' },
    ]);
    expect(errors).toEqual([
      { row: 1, code: 'invalid_id' },
      { row: 2, code: 'invalid_email' },
      { row: 3, code: 'invalid_email' },
    ]);
  });

  it('rejects over-length names', () => {
    const { errors } = validateAndNormalizeRows([{ first_name: 'x'.repeat(130) }]);
    expect(errors).toEqual([{ row: 1, code: 'invalid_row' }]);
  });

  it('keeps foreign phones as typed and drops empty fields from the payload', () => {
    const { rows, errors } = validateAndNormalizeRows([
      { first_name: 'John', phone: '+44 20 7946 0958', email: '' },
    ]);
    expect(errors).toEqual([]);
    expect(rows[0]?.phone).toBe('+44 20 7946 0958');
    expect('email' in (rows[0] ?? {})).toBe(false);
  });
});
