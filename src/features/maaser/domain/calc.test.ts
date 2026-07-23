import { describe, expect, it } from 'vitest';

import { computeMaaserSummary, sumAmounts, type MaaserBasisInput } from './calc';

/** 100,000 fee collected, no commissions, no manual lines by default. */
const basis = (over: Partial<MaaserBasisInput> = {}): MaaserBasisInput => ({
  feeCollected: 100_000,
  commissions: 0,
  manualIncome: 0,
  manualExpenses: 0,
  ...over,
});

describe('computeMaaserSummary', () => {
  it('derives 10% / 20% obligations from the collected fee', () => {
    const s = computeMaaserSummary(basis(), 0);
    expect(s.grossIncome).toBe(100_000);
    expect(s.netFee).toBe(100_000);
    expect(s.maaserDue).toBe(10_000);
    expect(s.chomeshDue).toBe(20_000);
    expect(s.maaserRemaining).toBe(10_000);
    expect(s.maaserPct).toBe(0);
  });

  it('subtracts commissions paid out of the fee', () => {
    const s = computeMaaserSummary(basis({ commissions: 20_000 }), 0);
    expect(s.netFee).toBe(80_000);
    expect(s.maaserDue).toBe(8_000);
    expect(s.chomeshDue).toBe(16_000);
  });

  it('adds manual income and subtracts manual expenses', () => {
    const s = computeMaaserSummary(
      basis({ commissions: 10_000, manualIncome: 20_000, manualExpenses: 5_000 }),
      0,
    );
    // gross = 100k + 20k = 120k; minus 10k commissions, minus 5k manual = 105k
    expect(s.grossIncome).toBe(120_000);
    expect(s.netFee).toBe(105_000);
    expect(s.maaserDue).toBe(10_500);
  });

  it('nets donations against both obligations', () => {
    const s = computeMaaserSummary(basis(), 6_000);
    expect(s.totalGiven).toBe(6_000);
    expect(s.maaserRemaining).toBe(4_000); // 10,000 − 6,000
    expect(s.chomeshRemaining).toBe(14_000); // 20,000 − 6,000
    expect(s.maaserPct).toBe(60);
    expect(s.chomeshPct).toBe(30);
  });

  it('goes negative once you give more than the maaser', () => {
    const s = computeMaaserSummary(basis(), 12_000);
    expect(s.maaserRemaining).toBe(-2_000);
    expect(s.maaserPct).toBe(100); // capped
    expect(s.chomeshRemaining).toBe(8_000);
  });

  it('floors the net base at zero when deductions exceed income', () => {
    const s = computeMaaserSummary(basis({ feeCollected: 1_000, commissions: 5_000 }), 1_000);
    expect(s.netFee).toBe(0);
    expect(s.maaserDue).toBe(0);
    expect(s.maaserPct).toBe(100); // gave something against a zero obligation
    expect(s.maaserRemaining).toBe(-1_000);
  });

  it("matches the owner's live figures (86,500 fee − 21,000 commissions)", () => {
    const s = computeMaaserSummary(basis({ feeCollected: 86_500, commissions: 21_000 }), 9_943);
    expect(s.netFee).toBe(65_500);
    expect(s.maaserDue).toBe(6_550);
    expect(s.chomeshDue).toBe(13_100);
    expect(s.maaserRemaining).toBeCloseTo(-3_393, 5); // maaser already fulfilled
    expect(s.chomeshRemaining).toBeCloseTo(3_157, 5); // chomesh still owed
  });
});

describe('sumAmounts', () => {
  it('sums amounts, ignoring non-finite', () => {
    expect(sumAmounts([1000, 2500, 500])).toBe(4000);
    expect(sumAmounts([1000, NaN, 500])).toBe(1500);
    expect(sumAmounts([])).toBe(0);
  });
});
