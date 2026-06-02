import { effectiveAnnualRatePct } from './rate';

import type { CurvePoint, MoneyAgorot, TrackInput } from '../types';

/** ₪ repaid per ₪ borrowed (total cost ÷ principal). 0 when principal is 0. */
export function costPerShekel(totalCost: MoneyAgorot, principal: MoneyAgorot): number {
  return principal > 0 ? totalCost / principal : 0;
}

/** Amount-weighted *effective* annual rate (%), monthly-compounded — a 4.86%
 *  nominal track reads as ~4.97%, matching the Bank of Israel "total expected
 *  interest" figure. Each track first resolves to its all-in rate (eligibility
 *  discount/cap), then compounds. */
export function blendedEffectiveRatePct(tracks: ReadonlyArray<TrackInput>): number {
  const total = tracks.reduce((sum, track) => sum + track.amount, 0);
  if (total <= 0) return 0;
  const weighted = tracks.reduce((sum, track) => {
    const effective = (Math.pow(1 + effectiveAnnualRatePct(track) / 1200, 12) - 1) * 100;
    return sum + track.amount * effective;
  }, 0);
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
