import type { MoneyAgorot, TrackInput, TrackType } from '../types';

/** Coarse mortgage-mix families used for the on-screen composition bar. */
export type CompositionFamily = 'fixed' | 'prime' | 'variable' | 'eligibility';

export type CompositionSlice = { family: CompositionFamily; amount: MoneyAgorot; share: number };

const TRACK_FAMILY: Record<TrackType, CompositionFamily> = {
  fixed_unlinked: 'fixed',
  fixed_linked: 'fixed',
  prime: 'prime',
  variable_unlinked: 'variable',
  variable_linked: 'variable',
  eligibility: 'eligibility',
};

const FAMILY_ORDER: ReadonlyArray<CompositionFamily> = ['fixed', 'prime', 'variable', 'eligibility'];

/**
 * Groups tracks into families and returns each present family's amount and
 * share of the total (0–1), in a stable order for a stacked bar. Pure: no
 * rounding here (callers format at the edge). Non-positive amounts are ignored.
 */
export function composeMixByFamily(tracks: ReadonlyArray<TrackInput>): ReadonlyArray<CompositionSlice> {
  const totals = new Map<CompositionFamily, number>();
  let grandTotal = 0;
  for (const track of tracks) {
    const amount = Math.max(0, track.amount);
    if (amount === 0) continue;
    const family = TRACK_FAMILY[track.type];
    totals.set(family, (totals.get(family) ?? 0) + amount);
    grandTotal += amount;
  }
  if (grandTotal === 0) return [];
  return FAMILY_ORDER.filter((family) => (totals.get(family) ?? 0) > 0).map((family) => {
    const amount = totals.get(family) ?? 0;
    return { family, amount, share: amount / grandTotal };
  });
}
