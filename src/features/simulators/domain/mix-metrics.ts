import { effectiveAnnualRatePct } from './rate';

import type { CurvePoint, MoneyAgorot, TrackInput } from '../types';

/** ₪ repaid per ₪ borrowed (total cost ÷ principal). 0 when principal is 0. */
export function costPerShekel(totalCost: MoneyAgorot, principal: MoneyAgorot): number {
  return principal > 0 ? totalCost / principal : 0;
}

/** Amount-weighted average effective annual rate (%) across the mix. Prime and
 *  eligibility tracks contribute their *effective* rate (incl. margin/cap). */
export function weightedAnnualRatePct(tracks: ReadonlyArray<TrackInput>): number {
  const total = tracks.reduce((sum, track) => sum + track.amount, 0);
  if (total <= 0) return 0;
  const weighted = tracks.reduce(
    (sum, track) => sum + track.amount * effectiveAnnualRatePct(track),
    0,
  );
  return weighted / total;
}

/** 1-based month index where the curve peaks (0 when empty). */
export function peakMonth(curve: ReadonlyArray<CurvePoint>): number {
  let month = 0;
  let max = -1;
  for (const point of curve) {
    if (point.value > max) {
      max = point.value;
      month = point.monthIndex;
    }
  }
  return month;
}
