import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calculateAge } from './age';

describe('calculateAge', () => {
  // Pin "now" so the assertions don't drift over time. Picked a date well
  // past the test birthdates below so positive ages always come back.
  const FROZEN_NOW = new Date('2026-05-26T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for missing input', () => {
    expect(calculateAge(null)).toBeNull();
    expect(calculateAge(undefined)).toBeNull();
    expect(calculateAge('')).toBeNull();
  });

  it('returns null for an unparseable date string', () => {
    expect(calculateAge('not-a-date')).toBeNull();
  });

  it('returns null for a future birth date (avoids negative ages)', () => {
    expect(calculateAge('2030-01-01')).toBeNull();
  });

  it('computes ~25.4 years for someone born 2001-01-01 (mid-2026)', () => {
    // 2001-01-01 → 2026-05-26 is ~25.4 years.
    const age = calculateAge('2001-01-01');
    expect(age).toBe('25.40');
  });

  it('returns a string with 2 decimal places', () => {
    const age = calculateAge('1990-06-15');
    expect(age).toMatch(/^\d+\.\d{2}$/);
  });

  it('handles a birthdate of today (close to zero)', () => {
    const age = calculateAge('2026-05-26');
    // Within the same UTC day but with the 12:00 offset, age is a tiny
    // positive fraction; just assert it parses to a small non-negative.
    expect(age).not.toBeNull();
    expect(Number(age)).toBeGreaterThanOrEqual(0);
    expect(Number(age)).toBeLessThan(0.01);
  });
});
