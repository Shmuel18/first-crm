import { calculateLtv } from '@/features/cases/domain/calculations';

import { sumMoney } from './money';

import type {
  MixInput,
  PropertyKind,
  RegulatoryThresholds,
  RegulatoryViolation,
  TrackInput,
} from '../types';

export function validateMix(
  input: MixInput,
  thresholds: RegulatoryThresholds,
  propertyKind: PropertyKind,
): ReadonlyArray<RegulatoryViolation> {
  return [
    amountMismatch(input),
    ltvViolation(input, thresholds, propertyKind),
    shareViolation('fixed_share_too_low', fixedAmount(input.tracks), input.mortgageAmount, thresholds.minFixedPct, 'min'),
    shareViolation('prime_share_too_high', primeAmount(input.tracks), input.mortgageAmount, thresholds.maxPrimePct, 'max'),
    shareViolation('equal_principal_share_too_high', equalPrincipalAmount(input.tracks), input.mortgageAmount, thresholds.maxEqualPrincipalPct, 'max'),
    termViolation(input, thresholds),
  ].filter((item): item is RegulatoryViolation => item !== null);
}

function amountMismatch(input: MixInput): RegulatoryViolation | null {
  const actual = sumMoney(input.tracks.map((track) => track.amount));
  if (actual === input.mortgageAmount) return null;
  return { code: 'amount_mismatch', actual, limit: input.mortgageAmount };
}

function ltvViolation(
  input: MixInput,
  thresholds: RegulatoryThresholds,
  propertyKind: PropertyKind,
): RegulatoryViolation | null {
  const actual = calculateLtv(input.propertyValue, input.mortgageAmount);
  const limit = thresholds.maxLtvPct[propertyKind];
  return actual !== null && actual > limit ? { code: 'ltv_exceeded', actual, limit } : null;
}

// Tolerance (in percentage points) for share comparisons. A track that is
// exactly a third / two-thirds of the loan computes to 33.3333…% / 66.6666…%,
// which can land a hair on the wrong side of a stored threshold — e.g. the DB
// seeds minFixedPct as 33.3334 (migration 094), fractionally ABOVE a true
// third, so an exact-third fixed split was flagged as "fixed share too low".
// 0.01pp forgives that floating/rounding boundary without loosening any real
// regulatory margin (shares are displayed to 0.1%).
const SHARE_TOLERANCE = 0.01;

function shareViolation(
  code: RegulatoryViolation['code'],
  amount: number,
  total: number,
  limit: number,
  mode: 'min' | 'max',
): RegulatoryViolation | null {
  const actual = total > 0 ? (amount / total) * 100 : 0;
  if (mode === 'min' && actual < limit - SHARE_TOLERANCE) return { code, actual, limit };
  if (mode === 'max' && actual > limit + SHARE_TOLERANCE) return { code, actual, limit };
  return null;
}

function fixedAmount(tracks: ReadonlyArray<TrackInput>): number {
  return sumMoney(tracks.filter((t) => t.type === 'fixed_linked' || t.type === 'fixed_unlinked' || t.type === 'eligibility').map((t) => t.amount));
}

function primeAmount(tracks: ReadonlyArray<TrackInput>): number {
  return sumMoney(tracks.filter((track) => track.type === 'prime').map((track) => track.amount));
}

function equalPrincipalAmount(tracks: ReadonlyArray<TrackInput>): number {
  return sumMoney(tracks.filter((track) => track.repayment === 'equal_principal').map((track) => track.amount));
}

function termViolation(input: MixInput, thresholds: RegulatoryThresholds): RegulatoryViolation | null {
  const actual = Math.max(input.defaultTermMonths, ...input.tracks.map((track) => track.termMonths));
  return actual > thresholds.maxTermMonths ? { code: 'term_too_long', actual, limit: thresholds.maxTermMonths } : null;
}

