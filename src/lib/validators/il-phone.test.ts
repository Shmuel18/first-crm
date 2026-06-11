import { describe, expect, it } from 'vitest';

import {
  isValidIsraeliPhone,
  isValidPhone,
  normalizeIsraeliPhone,
  normalizePhone,
} from './il-phone';

describe('normalizeIsraeliPhone', () => {
  it('canonicalizes every common mobile spelling to the same value', () => {
    expect(normalizeIsraeliPhone('050-1234567')).toBe('0501234567');
    expect(normalizeIsraeliPhone('050 123 4567')).toBe('0501234567');
    expect(normalizeIsraeliPhone('0501234567')).toBe('0501234567');
    expect(normalizeIsraeliPhone('+972 50 123 4567')).toBe('0501234567');
    expect(normalizeIsraeliPhone('972501234567')).toBe('0501234567');
  });

  it('accepts landlines (02/03/04/08/09) and VoIP (07X)', () => {
    expect(normalizeIsraeliPhone('02-1234567')).toBe('021234567');
    expect(normalizeIsraeliPhone('09 123 4567')).toBe('091234567');
    expect(normalizeIsraeliPhone('077-911-1111')).toBe('0779111111');
  });

  it('rejects 0-prefixed strings outside real Israeli ranges', () => {
    expect(normalizeIsraeliPhone('0123456789')).toBeNull(); // 01X is not a range
    expect(normalizeIsraeliPhone('0000000000')).toBeNull();
    expect(normalizeIsraeliPhone('0612345678')).toBeNull(); // 06 unassigned
    expect(normalizeIsraeliPhone('050123456')).toBeNull(); // mobile must be 10 digits
  });

  it('rejects empty / non-numeric input', () => {
    expect(normalizeIsraeliPhone('')).toBeNull();
    expect(normalizeIsraeliPhone('abc')).toBeNull();
  });
});

describe('isValidIsraeliPhone', () => {
  it('mirrors the normalizer', () => {
    expect(isValidIsraeliPhone('050-1234567')).toBe(true);
    expect(isValidIsraeliPhone('0000000000')).toBe(false);
  });
});

describe('isValidPhone (Israeli OR foreign)', () => {
  it('accepts foreign numbers in the E.164 digit range', () => {
    expect(isValidPhone('+1 650 123 4567')).toBe(true);
    expect(isValidPhone('+44 20 7946 0958')).toBe(true);
  });

  it('rejects too-short values and repeated-digit garbage', () => {
    expect(isValidPhone('123')).toBe(false);
    expect(isValidPhone('0000000000')).toBe(false);
    expect(isValidPhone('1111111')).toBe(false);
  });

  it('rejects values with letters', () => {
    expect(isValidPhone('050-CALL-NOW')).toBe(false);
  });
});

describe('normalizePhone (canonical storage form)', () => {
  it('canonicalizes Israeli, keeps foreign as typed (trimmed)', () => {
    expect(normalizePhone('+972-50-123-4567')).toBe('0501234567');
    expect(normalizePhone(' +44 20 7946 0958 ')).toBe('+44 20 7946 0958');
    expect(normalizePhone('')).toBeNull();
  });
});
