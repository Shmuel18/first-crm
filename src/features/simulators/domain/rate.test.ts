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

  it('treats prime as Bank-of-Israel rate plus the configured 1.5% margin', () => {
    expect(effectiveAnnualRatePct(track('prime', 4))).toBe(5.5);
  });

  it('discounts eligibility and caps it at 3%', () => {
    expect(effectiveAnnualRatePct(track('eligibility', 4.2))).toBe(3);
    expect(effectiveAnnualRatePct(track('eligibility', 2.8))).toBe(2.3);
  });
});

