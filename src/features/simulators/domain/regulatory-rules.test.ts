import { describe, expect, it } from 'vitest';

import { DEFAULT_REGULATORY_THRESHOLDS } from '../constants';
import { validateMix } from './regulatory-rules';

import type { MixInput, TrackInput } from '../types';

const track = (patch: Partial<TrackInput>): TrackInput => ({
  id: patch.id ?? 'track',
  type: patch.type ?? 'fixed_unlinked',
  amount: patch.amount ?? 750_000,
  annualRatePct: 3,
  termMonths: patch.termMonths ?? 360,
  repayment: patch.repayment ?? 'spitzer',
  cpiAnnualPct: null,
  graceMonths: null,
});

describe('validateMix', () => {
  it('passes a valid first-home structure', () => {
    const mix: MixInput = {
      mortgageAmount: 750_000,
      propertyValue: 1_000_000,
      equity: 250_000,
      defaultTermMonths: 360,
      tracks: [track({})],
    };

    expect(validateMix(mix, DEFAULT_REGULATORY_THRESHOLDS, 'first_home')).toEqual([]);
  });

  it('returns all blocking regulatory violations for invalid structure', () => {
    const mix: MixInput = {
      mortgageAmount: 900_000,
      propertyValue: 1_000_000,
      equity: 100_000,
      defaultTermMonths: 420,
      tracks: [
        track({ id: 'prime', type: 'prime', amount: 700_000, termMonths: 420 }),
        track({ id: 'eq', type: 'variable_unlinked', repayment: 'equal_principal', amount: 200_000 }),
      ],
    };

    const codes = validateMix(mix, DEFAULT_REGULATORY_THRESHOLDS, 'first_home').map((v) => v.code);

    expect(codes).toContain('ltv_exceeded');
    expect(codes).toContain('fixed_share_too_low');
    expect(codes).toContain('prime_share_too_high');
    expect(codes).toContain('term_too_long');
  });

  it('accepts an exact one-third fixed split as a boundary, not a violation', () => {
    const mix: MixInput = {
      mortgageAmount: 900_000,
      propertyValue: 1_800_000,
      equity: 900_000,
      defaultTermMonths: 360,
      tracks: [
        track({ id: 'fixed', type: 'fixed_unlinked', amount: 300_000 }),
        track({ id: 'prime', type: 'prime', amount: 300_000 }),
        track({ id: 'var', type: 'variable_unlinked', amount: 300_000 }),
      ],
    };

    const codes = validateMix(mix, DEFAULT_REGULATORY_THRESHOLDS, 'first_home').map((v) => v.code);

    expect(codes).not.toContain('fixed_share_too_low');
  });

  // Regression: the DB seeds minFixedPct as 33.3334 (migration 094) — a hair
  // ABOVE a true third. Without the share tolerance, an exact one-third fixed
  // split (33.3333…%) was flagged as "fixed share too low" (false positive,
  // which also blocked the save button). The 0.01pp tolerance fixes it.
  it('accepts an exact third even when the threshold is the DB value 33.3334', () => {
    const thresholds = { ...DEFAULT_REGULATORY_THRESHOLDS, minFixedPct: 33.3334 };
    const mix: MixInput = {
      mortgageAmount: 900_000,
      propertyValue: 1_800_000,
      equity: 900_000,
      defaultTermMonths: 360,
      tracks: [
        track({ id: 'fixed', type: 'fixed_unlinked', amount: 300_000 }),
        track({ id: 'prime', type: 'prime', amount: 300_000 }),
        track({ id: 'var', type: 'variable_unlinked', amount: 300_000 }),
      ],
    };

    const codes = validateMix(mix, thresholds, 'first_home').map((v) => v.code);

    expect(codes).not.toContain('fixed_share_too_low');
  });

  it('still flags a genuinely low fixed share (well below the third)', () => {
    const mix: MixInput = {
      mortgageAmount: 900_000,
      propertyValue: 1_800_000,
      equity: 900_000,
      defaultTermMonths: 360,
      tracks: [
        track({ id: 'fixed', type: 'fixed_unlinked', amount: 100_000 }),
        track({ id: 'prime', type: 'prime', amount: 400_000 }),
        track({ id: 'var', type: 'variable_unlinked', amount: 400_000 }),
      ],
    };

    const codes = validateMix(mix, DEFAULT_REGULATORY_THRESHOLDS, 'first_home').map((v) => v.code);

    expect(codes).toContain('fixed_share_too_low');
  });
});

