import type { MixInput, TrackInput, TrackType } from '../types';

export function newTrack(
  type: TrackType,
  amount: number,
  annualRatePct: number,
  cpiAnnualPct: number | null = null,
): TrackInput {
  return {
    id: `track-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    amount,
    annualRatePct,
    termMonths: 360,
    repayment: 'spitzer',
    cpiAnnualPct,
    graceMonths: null,
  };
}

export function normalizeTrack(track: TrackInput): TrackInput {
  const linked = track.type.endsWith('_linked');
  return {
    ...track,
    cpiAnnualPct: linked ? track.cpiAnnualPct ?? 0 : null,
    graceMonths: track.repayment === 'balloon' ? track.graceMonths ?? 12 : null,
  };
}

export function remainingAmount(mortgageAmount: number, tracks: ReadonlyArray<TrackInput>): number {
  const used = tracks.reduce((sum, track) => sum + track.amount, 0);
  return Math.max(0, mortgageAmount - used);
}

export function cloneTracksWithNewIds(tracks: ReadonlyArray<TrackInput>): TrackInput[] {
  return tracks.map((track) => ({
    ...track,
    id: `track-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }));
}

export function buildMixInput(base: Omit<MixInput, 'tracks'>, tracks: ReadonlyArray<TrackInput>): MixInput {
  return { ...base, tracks };
}

export type UniformBasketKind = 'fixed_only' | 'thirds' | 'halves';

// Bank of Israel "uniform baskets" — the standard comparison mixes. Rates are
// editable example defaults; the first (fixed) track absorbs rounding so the
// split sums to the loan exactly and stays at/above the min-fixed share.
const BASKETS: Record<
  UniformBasketKind,
  ReadonlyArray<{ type: TrackType; share: number; rate: number; cpi: number | null }>
> = {
  fixed_only: [{ type: 'fixed_unlinked', share: 1, rate: 4.86, cpi: null }],
  thirds: [
    { type: 'fixed_unlinked', share: 1 / 3, rate: 4.86, cpi: null },
    { type: 'prime', share: 1 / 3, rate: 5.25, cpi: null },
    { type: 'variable_linked', share: 1 / 3, rate: 2.04, cpi: 2 },
  ],
  halves: [
    { type: 'fixed_unlinked', share: 1 / 2, rate: 4.86, cpi: null },
    { type: 'prime', share: 1 / 2, rate: 5.25, cpi: null },
  ],
};

export function buildUniformBasket(
  kind: UniformBasketKind,
  mortgageAmount: number,
  termMonths: number,
): TrackInput[] {
  const config = BASKETS[kind];
  const amounts = config.map((slice) => Math.round(mortgageAmount * slice.share));
  const drift = mortgageAmount - amounts.reduce((sum, value) => sum + value, 0);
  return config.map((slice, index) => ({
    ...newTrack(slice.type, (amounts[index] ?? 0) + (index === 0 ? drift : 0), slice.rate, slice.cpi),
    termMonths,
  }));
}
