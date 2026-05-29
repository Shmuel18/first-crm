import type { StressScenario } from './domain/scenario-stress';
import type { RegulatoryThresholds, ScenarioPresetKey } from './types';

export const MAX_TRACKS = 12;
export const DEFAULT_PRIME_MARGIN_PCT = 1.5;
export const ELIGIBILITY_DISCOUNT_PCT = 0.5;
export const ELIGIBILITY_MAX_RATE_PCT = 3;

/** Stroke colors (CSS custom properties) for overlaying up to four mixes. */
export const SIM_SERIES_COLORS: readonly string[] = [
  'var(--color-sim-series-1)',
  'var(--color-sim-series-2)',
  'var(--color-sim-series-3)',
  'var(--color-sim-series-4)',
];

/** Stress presets the advisor can apply, then fine-tune (which switches to 'custom'). */
export type ScenarioPresetValues = Omit<StressScenario, 'paymentThreshold'>;

export const SCENARIO_PRESETS: Record<Exclude<ScenarioPresetKey, 'custom'>, ScenarioPresetValues> = {
  calm: { primeDeltaPct: 0.5, variableDeltaPct: 0.5, cpiAnnualPct: 1.5, changeMonth: 60 },
  moderate: { primeDeltaPct: 1.5, variableDeltaPct: 1.5, cpiAnnualPct: 2.5, changeMonth: 36 },
  strict: { primeDeltaPct: 3, variableDeltaPct: 3, cpiAnnualPct: 4, changeMonth: 12 },
};

export const DEFAULT_REGULATORY_THRESHOLDS: RegulatoryThresholds = {
  maxLtvPct: {
    first_home: 75,
    replacement: 70,
    investment: 50,
  },
  minFixedPct: 33.3333,
  maxPrimePct: 66.6667,
  maxEqualPrincipalPct: 30,
  maxTermMonths: 360,
};

