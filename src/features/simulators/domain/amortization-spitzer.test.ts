import { describe, expect, it } from 'vitest';

import { buildSpitzerSchedule } from './amortization-spitzer';

import type { TrackInput } from '../types';

const baseTrack: TrackInput = {
  id: 'track-1',
  type: 'fixed_unlinked',
  amount: 100_000_000,
  annualRatePct: 3,
  termMonths: 360,
  repayment: 'spitzer',
  cpiAnnualPct: null,
  graceMonths: null,
};

describe('buildSpitzerSchedule', () => {
  it('matches the standard mortgage PMT fixture for 1,000,000 NIS at 3% over 30 years', () => {
    const rows = buildSpitzerSchedule(baseTrack);

    expect(rows).toHaveLength(360);
    expect(rows[0]?.payment).toBe(421_604);
    expect(rows[0]?.interest).toBe(250_000);
    expect(rows.at(-1)?.closingBalance).toBe(0);
  });

  it('splits zero-interest loans evenly and closes the final balance', () => {
    const rows = buildSpitzerSchedule({ ...baseTrack, amount: 120_000, annualRatePct: 0, termMonths: 12 });

    expect(rows[0]?.payment).toBe(10_000);
    expect(rows.every((row) => row.interest === 0)).toBe(true);
    expect(rows.at(-1)?.closingBalance).toBe(0);
  });
});

