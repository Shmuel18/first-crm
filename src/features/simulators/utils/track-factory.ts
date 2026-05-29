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
