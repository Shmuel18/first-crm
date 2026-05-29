import { describe, expect, it } from 'vitest';

import type { TrackInput } from '../types';
import { composeMixByFamily } from './mix-composition';

function track(partial: Partial<TrackInput> & Pick<TrackInput, 'type' | 'amount'>): TrackInput {
  return {
    id: 'x',
    annualRatePct: 4,
    termMonths: 360,
    repayment: 'spitzer',
    cpiAnnualPct: null,
    graceMonths: null,
    ...partial,
  };
}

describe('composeMixByFamily', () => {
  it('returns empty for no tracks or only zero amounts', () => {
    expect(composeMixByFamily([])).toEqual([]);
    expect(composeMixByFamily([track({ type: 'prime', amount: 0 })])).toEqual([]);
  });

  it('merges linked + unlinked into one family and computes shares', () => {
    const slices = composeMixByFamily([
      track({ type: 'fixed_unlinked', amount: 30_000_000 }),
      track({ type: 'fixed_linked', amount: 10_000_000 }),
      track({ type: 'prime', amount: 60_000_000 }),
    ]);
    expect(slices).toEqual([
      { family: 'fixed', amount: 40_000_000, share: 0.4 },
      { family: 'prime', amount: 60_000_000, share: 0.6 },
    ]);
  });

  it('orders present families fixed → prime → variable → eligibility', () => {
    const slices = composeMixByFamily([
      track({ type: 'eligibility', amount: 10_000_000 }),
      track({ type: 'variable_linked', amount: 10_000_000 }),
      track({ type: 'prime', amount: 10_000_000 }),
      track({ type: 'fixed_unlinked', amount: 10_000_000 }),
    ]);
    expect(slices.map((slice) => slice.family)).toEqual(['fixed', 'prime', 'variable', 'eligibility']);
  });
});
