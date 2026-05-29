import { describe, expect, it } from 'vitest';

import { stressMix } from './scenario-stress';

import type { MixInput } from '../types';

const mix: MixInput = {
  mortgageAmount: 1_000_000,
  propertyValue: 2_000_000,
  equity: 1_000_000,
  defaultTermMonths: 24,
  tracks: [
    {
      id: 'prime',
      type: 'prime',
      amount: 1_000_000,
      annualRatePct: 4,
      termMonths: 24,
      repayment: 'spitzer',
      cpiAnnualPct: null,
      graceMonths: null,
    },
  ],
};

describe('stressMix', () => {
  it('applies rate shocks from the configured change month', () => {
    const baselineOnly = stressMix(mix, {
      primeDeltaPct: 6,
      variableDeltaPct: 0,
      cpiAnnualPct: 0,
      changeMonth: 13,
      paymentThreshold: null,
    });
    const result = stressMix(mix, {
      primeDeltaPct: 6,
      variableDeltaPct: 0,
      cpiAnnualPct: 0,
      changeMonth: 13,
      paymentThreshold: baselineOnly.baseline.maxPayment,
    });

    expect(result.stressed.paymentCurve[0]?.value).toBe(result.baseline.paymentCurve[0]?.value);
    expect(result.stressed.maxPayment).toBeGreaterThan(result.baseline.maxPayment);
    expect(result.thresholdCrossMonth).toBe(13);
  });

  it('scores low risk when nothing changes and high risk under a severe rate shock', () => {
    const flat = stressMix(mix, {
      primeDeltaPct: 0,
      variableDeltaPct: 0,
      cpiAnnualPct: 0,
      changeMonth: 999,
      paymentThreshold: null,
    });
    expect(flat.paymentIncreasePct).toBe(0);
    expect(flat.risk).toBe('low');

    const firstTrack = mix.tracks[0];
    if (!firstTrack) throw new Error('fixture must have at least one track');
    const longMix: MixInput = {
      ...mix,
      defaultTermMonths: 360,
      tracks: [{ ...firstTrack, termMonths: 360 }],
    };
    const shock = stressMix(longMix, {
      primeDeltaPct: 8,
      variableDeltaPct: 0,
      cpiAnnualPct: 0,
      changeMonth: 1,
      paymentThreshold: null,
    });
    expect(shock.risk).toBe('high');
  });

  it('counts linked-principal growth toward risk under a CPI shock (regression: was ignored)', () => {
    const firstTrack = mix.tracks[0];
    if (!firstTrack) throw new Error('fixture must have at least one track');
    const linkedMix: MixInput = {
      ...mix,
      tracks: [{ ...firstTrack, type: 'fixed_linked', termMonths: 360, cpiAnnualPct: 0 }],
    };

    const result = stressMix(linkedMix, {
      primeDeltaPct: 0,
      variableDeltaPct: 0,
      cpiAnnualPct: 6,
      changeMonth: 1,
      paymentThreshold: null,
    });

    expect(result.linkedPrincipalGrowth).toBeGreaterThan(0);
    expect(result.risk).toBe('high');
  });
});
