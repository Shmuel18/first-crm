import { describe, expect, it } from 'vitest';

import { applyMonthlyIndexation } from './cpi-indexation';

const ANNUAL_CPI_FOR_ONE_PERCENT_MONTHLY = 12.682503013196978;

describe('applyMonthlyIndexation', () => {
  it('applies geometric monthly CPI to the balance before interest is calculated', () => {
    const indexed = applyMonthlyIndexation(12_000_000, ANNUAL_CPI_FOR_ONE_PERCENT_MONTHLY);

    expect(indexed.balance).toBe(12_120_000);
    expect(indexed.indexation).toBe(120_000);
  });

  it('does nothing when a track is unlinked', () => {
    expect(applyMonthlyIndexation(12_000_000, null)).toEqual({
      balance: 12_000_000,
      indexation: 0,
    });
  });
});

