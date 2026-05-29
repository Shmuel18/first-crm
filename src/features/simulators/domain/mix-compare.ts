import { aggregateMix } from './mix-aggregate';
import { composeMixByFamily } from './mix-composition';

import type { MixInput, MixResult } from '../types';

export interface MixComparisonInput {
  label: string;
  mix: MixInput;
}

export interface MixComparisonRow {
  label: string;
  result: MixResult;
  paymentIncreaseRiskPct: number;
  /** Share (%) of fixed-rate + eligibility principal — lower = more flexible. */
  inflexibleSharePct: number;
}

export interface MixComparisonResult {
  rows: ReadonlyArray<MixComparisonRow>;
  cheapestLabel: string;
  mostStableLabel: string;
  mostFlexibleLabel: string;
  riskiestLabel: string;
}

export function compareMixes(inputs: ReadonlyArray<MixComparisonInput>): MixComparisonResult {
  const rows = inputs.map((item) => rowForMix(item.label, item.mix));
  return {
    rows,
    cheapestLabel: minBy(rows, (row) => row.result.totalCost).label,
    mostStableLabel: minBy(rows, (row) => row.paymentIncreaseRiskPct).label,
    mostFlexibleLabel: minBy(rows, (row) => row.inflexibleSharePct).label,
    riskiestLabel: maxBy(rows, (row) => row.paymentIncreaseRiskPct).label,
  };
}

function rowForMix(label: string, mix: MixInput): MixComparisonRow {
  const result = aggregateMix(mix);
  const risk = result.firstPayment > 0 ? (result.maxPayment / result.firstPayment - 1) * 100 : 0;
  return {
    label,
    result,
    paymentIncreaseRiskPct: Math.round(risk * 10) / 10,
    inflexibleSharePct: inflexibleSharePct(mix),
  };
}

/**
 * Share (%) of "inflexible" principal — fixed-rate and eligibility tracks,
 * which carry prepayment penalties and the least flexibility. Reuses the same
 * family grouping as the on-screen composition bar. Lower = more flexible.
 */
function inflexibleSharePct(mix: MixInput): number {
  const inflexible = composeMixByFamily(mix.tracks)
    .filter((slice) => slice.family === 'fixed' || slice.family === 'eligibility')
    .reduce((sum, slice) => sum + slice.share, 0);
  return inflexible * 100;
}

function minBy<T>(items: ReadonlyArray<T>, value: (item: T) => number): T {
  return items.reduce((best, item) => (value(item) < value(best) ? item : best));
}

function maxBy<T>(items: ReadonlyArray<T>, value: (item: T) => number): T {
  return items.reduce((best, item) => (value(item) > value(best) ? item : best));
}

