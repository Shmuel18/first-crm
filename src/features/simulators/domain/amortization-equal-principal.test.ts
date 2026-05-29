import { describe, expect, it } from 'vitest';

import { buildEqualPrincipalSchedule } from './amortization-equal-principal';

import type { TrackInput } from '../types';

const track: TrackInput = {
  id: 'equal',
  type: 'fixed_unlinked',
  amount: 12_000_000,
  annualRatePct: 12,
  termMonths: 12,
  repayment: 'equal_principal',
  cpiAnnualPct: null,
  graceMonths: null,
};

describe('buildEqualPrincipalSchedule', () => {
  it('keeps principal equal and payments decline month by month', () => {
    const rows = buildEqualPrincipalSchedule(track);

    expect(rows[0]?.principal).toBe(1_000_000);
    expect(rows[0]?.payment).toBe(1_120_000);
    expect(rows[1]?.payment).toBe(1_110_000);
    expect(rows.at(-1)?.payment).toBe(1_010_000);
    expect(rows.at(-1)?.closingBalance).toBe(0);
  });
});

