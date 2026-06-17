import type { CompositionSlice } from './mix-composition';

import type { RiskLevel } from '../types';

export interface MixExposure {
  /** Combined prime + variable share of the mix (0–100) — the part that floats with rates. */
  exposurePct: number;
  level: RiskLevel;
}

/** A third — mirrors the regulator's min-fixed / max-prime line. */
const MEDIUM_THRESHOLD_PCT = 100 / 3;
const HIGH_THRESHOLD_PCT = 55;

/**
 * How rate-sensitive a mix is — the combined prime + variable share. This is the
 * exposure the Bank of Israel caps via the min-fixed / max-prime rules, so it is
 * an honest structural risk signal without running a stress simulation.
 */
export function rateExposure(slices: ReadonlyArray<CompositionSlice>): MixExposure {
  const exposurePct = slices
    .filter((slice) => slice.family === 'prime' || slice.family === 'variable')
    .reduce((sum, slice) => sum + slice.share * 100, 0);
  const level: RiskLevel =
    exposurePct > HIGH_THRESHOLD_PCT ? 'high' : exposurePct > MEDIUM_THRESHOLD_PCT ? 'medium' : 'low';
  return { exposurePct, level };
}
