import { describe, expect, it } from 'vitest';

import { compareMixes } from './mix-compare';

import type { MixInput } from '../types';

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
});

