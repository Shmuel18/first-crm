import { describe, expect, it } from 'vitest';

import {
  calculateAvailableIncome,
  calculateDtiBands,
  calculateDtiPercent,
  DTI_BANDS,
  isLongTermObligation,
} from './dti';

describe('isLongTermObligation', () => {
  it('counts >18 months as long-term', () => {
    expect(isLongTermObligation(19)).toBe(true);
    expect(isLongTermObligation(60)).toBe(true);
  });

  it('counts exactly 18 months as short-term', () => {
    expect(isLongTermObligation(18)).toBe(false);
  });

  it('counts <18 months as short-term', () => {
    expect(isLongTermObligation(6)).toBe(false);
    expect(isLongTermObligation(0)).toBe(false);
  });

  it('treats unknown remaining months as long-term (conservative)', () => {
    expect(isLongTermObligation(null)).toBe(true);
    expect(isLongTermObligation(undefined)).toBe(true);
  });
});

describe('calculateAvailableIncome', () => {
  it('returns income minus long-term obligations', () => {
    expect(calculateAvailableIncome(16_878, 10_000)).toBe(6_878);
  });

  it('clamps negative results to 0', () => {
    expect(calculateAvailableIncome(5_000, 8_000)).toBe(0);
  });

  it('handles zero income', () => {
    expect(calculateAvailableIncome(0, 0)).toBe(0);
    expect(calculateAvailableIncome(0, 1_000)).toBe(0);
  });

  it('returns full income when no obligations', () => {
    expect(calculateAvailableIncome(10_000, 0)).toBe(10_000);
  });
});

describe('calculateDtiBands', () => {
  it('returns the three standard bands (30/34/38%)', () => {
    const bands = calculateDtiBands(6_878);
    expect(bands.map((b) => b.ratio)).toEqual([30, 34, 38]);
  });

  it('matches the WISE competitor numbers (6,878 → 2,063 / 2,339 / 2,614)', () => {
    const bands = calculateDtiBands(6_878);
    expect(bands.map((b) => b.payment)).toEqual([2_063, 2_339, 2_614]);
  });

  it('returns zeros when available income is 0', () => {
    const bands = calculateDtiBands(0);
    expect(bands.map((b) => b.payment)).toEqual([0, 0, 0]);
  });

  it('exposes DTI_BANDS as the source of truth for ratios', () => {
    const bands = calculateDtiBands(10_000);
    expect(bands.map((b) => b.ratio)).toEqual([...DTI_BANDS]);
  });
});

describe('calculateDtiPercent', () => {
  it('returns obligations / income × 100, one decimal', () => {
    expect(calculateDtiPercent(10_000, 16_878)).toBe(59.2);
  });

  it('returns 0 when no obligations', () => {
    expect(calculateDtiPercent(0, 10_000)).toBe(0);
  });

  it('returns null when income is 0 (avoids divide-by-zero)', () => {
    expect(calculateDtiPercent(1_000, 0)).toBeNull();
  });

  it('returns null when income is negative (unmeaningful)', () => {
    expect(calculateDtiPercent(1_000, -500)).toBeNull();
  });

  it('rounds to one decimal', () => {
    // 1234 / 5678 × 100 = 21.733004... → 21.7
    expect(calculateDtiPercent(1234, 5678)).toBe(21.7);
  });
});
