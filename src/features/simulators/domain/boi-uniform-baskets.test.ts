import { describe, expect, it } from 'vitest';

import { aggregateMix } from './mix-aggregate';
import { agorotToNis } from '../utils/format';

import type { MixInput, TrackInput } from '../types';

// Cross-check against the official Bank of Israel "uniform baskets" calculator
// (boi.org.il). Basket 1 — 100% fixed unlinked, no prime/CPI confounds — must
// reproduce the published figures to the agora, anchoring "fire-and-forget"
// trust in the engine. Amounts are in agorot.
const fixedTrack: TrackInput = {
  id: 'b1',
  type: 'fixed_unlinked',
  amount: 1_000_000_00,
  annualRatePct: 4.86,
  termMonths: 360,
  repayment: 'spitzer',
  cpiAnnualPct: null,
  graceMonths: null,
};

const basket1: MixInput = {
  mortgageAmount: 1_000_000_00,
  propertyValue: 2_000_000_00,
  equity: 1_000_000_00,
  defaultTermMonths: 360,
  tracks: [fixedTrack],
};

describe('BoI uniform basket 1 — golden cross-check', () => {
  const result = aggregateMix(basket1);

  it('reproduces the first monthly payment (BoI: 5,282.99)', () => {
    expect(agorotToNis(result.firstPayment)).toBe(5283);
  });

  it('keeps a flat payment for a fixed loan (highest === first)', () => {
    expect(agorotToNis(result.maxPayment)).toBe(5283);
  });

  it('reproduces the total paid over the term (BoI: 1,901,873.15)', () => {
    expect(Math.abs(agorotToNis(result.totalCost) - 1_901_873)).toBeLessThanOrEqual(50);
  });

  it('reports the effective annual rate (BoI "total expected interest": 4.97%)', () => {
    expect(result.effectiveRatePct).toBeCloseTo(4.97, 1);
  });
});
