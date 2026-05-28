import { aggregateMix } from './mix-aggregate';

import type { MixInput, MixResult } from '../types';

export interface MixComparisonInput {
  label: string;
  mix: MixInput;
}

export interface MixComparisonRow {
  label: string;
  result: MixResult;
  paymentIncreaseRiskPct: number;
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
    mostFlexibleLabel: minBy(rows, (row) => fixedShare(row.result)).label,
    riskiestLabel: maxBy(rows, (row) => row.paymentIncreaseRiskPct).label,
  };
}

function rowForMix(label: string, mix: MixInput): MixComparisonRow {
  const result = aggregateMix(mix);
  const risk = result.firstPayment > 0 ? (result.maxPayment / result.firstPayment - 1) * 100 : 0;
  return { label, result, paymentIncreaseRiskPct: Math.round(risk * 10) / 10 };
}

function fixedShare(result: MixResult): number {
  const total = result.tracks.reduce((sum, track) => sum + track.totalCost, 0);
  return total > 0 ? result.maxPayment / total : 0;
}

function minBy<T>(items: ReadonlyArray<T>, value: (item: T) => number): T {
  return items.reduce((best, item) => (value(item) < value(best) ? item : best));
}

function maxBy<T>(items: ReadonlyArray<T>, value: (item: T) => number): T {
  return items.reduce((best, item) => (value(item) > value(best) ? item : best));
}

