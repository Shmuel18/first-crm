import { describe, expect, it } from 'vitest';

import { computeMaaserSummary, sumGiven } from './calc';

describe('computeMaaserSummary', () => {
  it('derives 10% / 20% obligations from the net fee', () => {
    const s = computeMaaserSummary(120_000, 100_000, 0);
    expect(s.maaserDue).toBe(10_000);
    expect(s.chomeshDue).toBe(20_000);
    expect(s.maaserRemaining).toBe(10_000);
    expect(s.chomeshRemaining).toBe(20_000);
    expect(s.maaserPct).toBe(0);
  });

  it('nets donations against both obligations', () => {
    const s = computeMaaserSummary(120_000, 100_000, 6_000);
    expect(s.totalGiven).toBe(6_000);
    expect(s.maaserRemaining).toBe(4_000); // 10,000 − 6,000
    expect(s.chomeshRemaining).toBe(14_000); // 20,000 − 6,000
    expect(s.maaserPct).toBe(60);
    expect(s.chomeshPct).toBe(30);
  });

  it('goes negative once you give more than the maaser', () => {
    const s = computeMaaserSummary(120_000, 100_000, 12_000);
    expect(s.maaserRemaining).toBe(-2_000);
    expect(s.maaserPct).toBe(100); // capped
    expect(s.chomeshRemaining).toBe(8_000);
  });

  it('handles a zero / negative net fee safely', () => {
    const s = computeMaaserSummary(0, -500, 1_000);
    expect(s.netFee).toBe(0);
    expect(s.maaserDue).toBe(0);
    expect(s.maaserPct).toBe(100); // gave something against a zero obligation
    expect(s.maaserRemaining).toBe(-1_000);
  });
});

describe('sumGiven', () => {
  it('sums amounts, ignoring non-finite', () => {
    expect(sumGiven([1000, 2500, 500])).toBe(4000);
    expect(sumGiven([1000, NaN, 500])).toBe(1500);
    expect(sumGiven([])).toBe(0);
  });
});
