import {
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
  // Prime is entered as the all-in annual rate the borrower actually pays
  // (matching the Bank of Israel comparison tool and real bank offers, where
  // prime = BoI base + 1.5% ± the bank's margin), so nothing is added here.
  // Eligibility is the one regulated exception: discounted 0.5%, capped at 3%.
  if (track.type === 'eligibility') {
    return Math.min(track.annualRatePct - ELIGIBILITY_DISCOUNT_PCT, ELIGIBILITY_MAX_RATE_PCT);
  }
  return track.annualRatePct;
}

