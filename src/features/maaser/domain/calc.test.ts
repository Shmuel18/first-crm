import { describe, expect, it } from 'vitest';

import { computeMaaserSummary, sumAmounts, type MaaserBasisInput } from './calc';

/** collected − autoExpenses gives a 100,000 net unless overridden. */
const basis = (over: Partial<MaaserBasisInput> = {}): MaaserBasisInput => ({
  collected: 120_000,
  autoExpenses: 20_000,
  manualIncome: 0,
  manualExpenses: 0,
  ...over,
});

describe('computeMaaserSummary', () => {
  it('derives 10% / 20% obligations from the net base', () => {
    const s = computeMaaserSummary(basis(), 0);
    expect(s.grossIncome).toBe(120_000);
    expect(s.totalExpenses).toBe(20_000);
    expect(s.netFee).toBe(100_000);
    expect(s.maaserDue).toBe(10_000);
    expect(s.chomeshDue).toBe(20_000);
    expect(s.maaserRemaining).toBe(10_000);
    expect(s.chomeshRemaining).toBe(20_000);
    expect(s.maaserPct).toBe(0);
  });

  it('adds manual income and subtracts manual expenses from the base', () => {
    const s = computeMaaserSummary(basis({ manualIncome: 10_000, manualExpenses: 5_000 }), 0);
    // gross = 120k + 10k = 130k; expenses = 20k + 5k = 25k; net = 105k
    expect(s.grossIncome).toBe(130_000);
    expect(s.totalExpenses).toBe(25_000);
    expect(s.netFee).toBe(105_000);
    expect(s.maaserDue).toBe(10_500);
    expect(s.chomeshDue).toBe(21_000);
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

  it('floors the net base at zero when expenses exceed income', () => {
    const s = computeMaaserSummary(basis({ collected: 1_000, autoExpenses: 5_000 }), 1_000);
    expect(s.netFee).toBe(0);
    expect(s.maaserDue).toBe(0);
    expect(s.maaserPct).toBe(100); // gave something against a zero obligation
    expect(s.maaserRemaining).toBe(-1_000);
  });
});

describe('sumAmounts', () => {
  it('sums amounts, ignoring non-finite', () => {
    expect(sumAmounts([1000, 2500, 500])).toBe(4000);
    expect(sumAmounts([1000, NaN, 500])).toBe(1500);
    expect(sumAmounts([])).toBe(0);
  });
});
