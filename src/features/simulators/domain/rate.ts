import {
  DEFAULT_PRIME_MARGIN_PCT,
  ELIGIBILITY_DISCOUNT_PCT,
  ELIGIBILITY_MAX_RATE_PCT,
} from '../constants';
import type { TrackInput } from '../types';

export function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 100 / 12;
}

export function monthlyCpiRate(cpiAnnualPct: number | null): number {
  if (cpiAnnualPct === null) return 0;
  return Math.pow(1 + cpiAnnualPct / 100, 1 / 12) - 1;
}

export function effectiveAnnualRatePct(track: TrackInput): number {
  if (track.type === 'prime') return track.annualRatePct + DEFAULT_PRIME_MARGIN_PCT;
  if (track.type === 'eligibility') {
    return Math.min(track.annualRatePct - ELIGIBILITY_DISCOUNT_PCT, ELIGIBILITY_MAX_RATE_PCT);
  }
  return track.annualRatePct;
}

