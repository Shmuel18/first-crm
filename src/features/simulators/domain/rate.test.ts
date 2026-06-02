import { describe, expect, it } from 'vitest';

import { effectiveAnnualRatePct, monthlyRate } from './rate';

import type { TrackInput } from '../types';

const track = (type: TrackInput['type'], annualRatePct: number): TrackInput => ({
  id: type,
  type,
  amount: 1_000_000,
  annualRatePct,
  termMonths: 12,
  repayment: 'spitzer',
  cpiAnnualPct: null,
  graceMonths: null,
});

describe('rate helpers', () => {
  it('converts annual percentage to monthly decimal rate', () => {
    expect(monthlyRate(12)).toBe(0.01);
  });

  it('uses the entered prime rate directly (all-in, no auto margin)', () => {
    expect(effectiveAnnualRatePct(track('prime', 5.25))).toBe(5.25);
  });

  it('discounts eligibility and caps it at 3%', () => {
    expect(effectiveAnnualRatePct(track('eligibility', 4.2))).toBe(3);
    expect(effectiveAnnualRatePct(track('eligibility', 2.8))).toBe(2.3);
  });
});

