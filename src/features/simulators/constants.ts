import type { RegulatoryThresholds } from './types';

export const MAX_TRACKS = 12;
export const DEFAULT_PRIME_MARGIN_PCT = 1.5;
export const ELIGIBILITY_DISCOUNT_PCT = 0.5;
export const ELIGIBILITY_MAX_RATE_PCT = 3;

export const DEFAULT_REGULATORY_THRESHOLDS: RegulatoryThresholds = {
  maxLtvPct: {
    first_home: 75,
    replacement: 70,
    investment: 50,
  },
  minFixedPct: 33.3334,
  maxPrimePct: 66.6667,
  maxEqualPrincipalPct: 30,
  maxTermMonths: 360,
};

