import { describe, expect, it } from 'vitest';

import { isValidIdOrPassport, isValidIsraeliId } from './israeli-id';

describe('isValidIsraeliId', () => {
  it('accepts known checksum-valid 9-digit IDs', () => {
    // Synthetic IDs constructed to satisfy the official Luhn-variant checksum.
    expect(isValidIsraeliId('123456782')).toBe(true);
    expect(isValidIsraeliId('305448045')).toBe(true);
  });

  it('pads shorter inputs with leading zeros before checksumming', () => {
    // '12345674' → '012345674', which checksums to 30 (valid).
    expect(isValidIsraeliId('12345674')).toBe(true);
  });

  it('rejects checksum failures', () => {
    expect(isValidIsraeliId('123456789')).toBe(false);
    expect(isValidIsraeliId('305448044')).toBe(false);
  });

  it('rejects degenerate inputs that pad to a zero checksum', () => {
    expect(isValidIsraeliId('0')).toBe(false);
    expect(isValidIsraeliId('00000000')).toBe(false);
    expect(isValidIsraeliId('000000000')).toBe(false);
  });

  it('rejects too-short, too-long, and empty inputs', () => {
    expect(isValidIsraeliId('1234')).toBe(false); // below the 5-digit floor
    expect(isValidIsraeliId('1234567890')).toBe(false); // 10 digits
    expect(isValidIsraeliId('')).toBe(false);
    expect(isValidIsraeliId('abc')).toBe(false);
  });

  it('ignores embedded non-digit separators', () => {
    expect(isValidIsraeliId('12-345-6782')).toBe(true);
  });
});

describe('isValidIdOrPassport', () => {
  it('accepts passport-shaped alphanumerics within 4-20 chars', () => {
    expect(isValidIdOrPassport('AB123456')).toBe(true);
    expect(isValidIdOrPassport('123456782')).toBe(true);
  });

  it('rejects too-short, too-long, and symbol-bearing values', () => {
    expect(isValidIdOrPassport('a1')).toBe(false);
    expect(isValidIdOrPassport('a'.repeat(21))).toBe(false);
    expect(isValidIdOrPassport('12 34')).toBe(false);
  });
});
