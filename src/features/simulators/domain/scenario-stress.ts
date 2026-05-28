import { aggregateMix, aggregateTrackResults } from './mix-aggregate';
import { scoreRisk } from './risk-score';
import { firstMonthAboveThreshold } from './scenario-threshold';
import { buildTrackSchedule } from './track-payment';
import { summarizeTrack } from './track-summary';

import type { AmortizationRow, MixInput, MixResult, RiskLevel, TrackInput } from '../types';

export interface StressScenario {
  primeDeltaPct: number;
  variableDeltaPct: number;
  cpiAnnualPct: number;
  changeMonth: number;
  paymentThreshold: number | null;
}

export interface StressResult {
  baseline: MixResult;
  stressed: MixResult;
  paymentIncreasePct: number;
  thresholdCrossMonth: number | null;
  linkedPrincipalGrowth: number;
  risk: RiskLevel;
}

export function stressMix(input: MixInput, scenario: StressScenario): StressResult {
  const baseline = aggregateMix(input);
  const stressed = aggregateTrackResults(
    input,
    input.tracks.map((track) => summarizeTrack(track.id, stressedRows(track, scenario))),
  );
  const increasePct = increase(baseline.maxPayment, stressed.maxPayment);
  const linkedGrowth = stressed.totalIndexation - baseline.totalIndexation;
  return {
    baseline,
    stressed,
    paymentIncreasePct: increasePct,
    thresholdCrossMonth: thresholdMonth(stressed, scenario.paymentThreshold),
    linkedPrincipalGrowth: linkedGrowth,
    risk: scoreRisk(increasePct, increase(input.mortgageAmount, linkedGrowth)),
  };
}

function stressedRows(track: TrackInput, scenario: StressScenario): ReadonlyArray<AmortizationRow> {
  const baselineRows = buildTrackSchedule(track);
  const prefix = baselineRows.filter((row) => row.monthIndex < scenario.changeMonth);
  const remainingBalance = prefix.at(-1)?.closingBalance ?? track.amount;
  const remainingMonths = track.termMonths - prefix.length;
  if (remainingMonths <= 0) return prefix;
  const suffix = buildTrackSchedule(stressTrack(track, scenario, remainingBalance, remainingMonths));
  return prefix.concat(suffix.map((row) => ({ ...row, monthIndex: row.monthIndex + prefix.length })));
}

function stressTrack(
  track: TrackInput,
  scenario: StressScenario,
  amount: number,
  termMonths: number,
): TrackInput {
  return {
    ...track,
    amount,
    termMonths,
    annualRatePct: track.annualRatePct + rateDelta(track, scenario),
    cpiAnnualPct: track.type.endsWith('_linked') ? scenario.cpiAnnualPct : track.cpiAnnualPct,
    graceMonths: remainingGraceMonths(track, scenario.changeMonth),
  };
}

function remainingGraceMonths(track: TrackInput, changeMonth: number): number | null {
  if (track.repayment !== 'balloon' || track.graceMonths === null) return track.graceMonths;
  return Math.max(0, track.graceMonths - changeMonth + 1);
}

function rateDelta(track: TrackInput, scenario: StressScenario): number {
  if (track.type === 'prime') return scenario.primeDeltaPct;
  if (track.type === 'variable_linked' || track.type === 'variable_unlinked') return scenario.variableDeltaPct;
  return 0;
}

function increase(base: number, next: number): number {
  if (base <= 0) return next > 0 ? 100 : 0;
  return Math.round(((next - base) / base) * 1000) / 10;
}

function thresholdMonth(result: MixResult, threshold: number | null): number | null {
  return threshold === null ? null : firstMonthAboveThreshold(result.paymentCurve, threshold);
}
