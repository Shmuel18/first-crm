import { describe, expect, it } from 'vitest';

import { buildBalloonSchedule } from './amortization-balloon';

import type { TrackInput } from '../types';

const track: TrackInput = {
  id: 'balloon',
  type: 'fixed_unlinked',
  amount: 12_000_000,
  annualRatePct: 12,
  termMonths: 12,
  repayment: 'balloon',
  cpiAnnualPct: null,
  graceMonths: 3,
};

describe('buildBalloonSchedule', () => {
  it('charges interest-only during grace and then amortizes the balance', () => {
    const rows = buildBalloonSchedule(track);

    expect(rows[0]?.payment).toBe(120_000);
    expect(rows[0]?.principal).toBe(0);
    expect(rows[2]?.closingBalance).toBe(12_000_000);
    expect(rows[3]?.payment).toBe(1_400_884);
    expect(rows.at(-1)?.closingBalance).toBe(0);
  });
});

