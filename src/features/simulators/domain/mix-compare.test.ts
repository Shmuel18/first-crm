import { describe, expect, it } from 'vitest';

import { compareMixes } from './mix-compare';

import type { MixInput, TrackType } from '../types';

const mixWithRate = (label: string, annualRatePct: number): { label: string; mix: MixInput } => ({
  label,
  mix: {
    mortgageAmount: 1_000_000,
    propertyValue: 2_000_000,
    equity: 1_000_000,
    defaultTermMonths: 12,
    tracks: [
      {
        id: label,
        type: 'fixed_unlinked',
        amount: 1_000_000,
        annualRatePct,
        termMonths: 12,
        repayment: 'spitzer',
        cpiAnnualPct: null,
        graceMonths: null,
      },
    ],
  },
});

describe('compareMixes', () => {
  it('ranks the cheapest mix by total cost', () => {
    const result = compareMixes([mixWithRate('A', 5), mixWithRate('B', 3)]);

    expect(result.cheapestLabel).toBe('B');
    expect(result.rows).toHaveLength(2);
  });

  it('ranks the mix with the lowest fixed/eligibility share as most flexible', () => {
    const single = (label: string, type: TrackType): { label: string; mix: MixInput } => ({
      label,
      mix: {
        mortgageAmount: 1_000_000,
        propertyValue: 2_000_000,
        equity: 1_000_000,
        defaultTermMonths: 12,
        tracks: [
          {
            id: label,
            type,
            amount: 1_000_000,
            annualRatePct: 4,
            termMonths: 12,
            repayment: 'spitzer',
            cpiAnnualPct: type.endsWith('_linked') ? 2 : null,
            graceMonths: null,
          },
        ],
      },
    });

    const result = compareMixes([single('rigid', 'fixed_unlinked'), single('flex', 'prime')]);

    expect(result.mostFlexibleLabel).toBe('flex');
    expect(result.rows.find((row) => row.label === 'rigid')?.inflexibleSharePct).toBe(100);
    expect(result.rows.find((row) => row.label === 'flex')?.inflexibleSharePct).toBe(0);
  });
});

