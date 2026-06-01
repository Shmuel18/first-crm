import { calculateLtv } from '@/features/cases/domain/calculations';

import { costPerShekel, peakMonth, weightedAnnualRatePct } from './mix-metrics';
import { averageMoney, sumMoney } from './money';
import { buildTrackSchedule } from './track-payment';
import { summarizeTrack } from './track-summary';

import type { CurvePoint, MixInput, MixResult, MoneyAgorot, TrackResult } from '../types';

export function aggregateMix(input: MixInput): MixResult {
  const tracks = input.tracks.map((track) =>
    summarizeTrack(track.id, buildTrackSchedule(track), track.amount),
  );
  return aggregateTrackResults(input, tracks);
}

export function aggregateTrackResults(
  input: MixInput,
  tracks: ReadonlyArray<TrackResult>,
): MixResult {
  const maxMonths = Math.max(0, ...tracks.map((track) => track.rows.length));
  const payments = aggregateMonthly(tracks, maxMonths, 'payment');
  const balances = aggregateMonthly(tracks, maxMonths, 'closingBalance');
  const principals = aggregateMonthly(tracks, maxMonths, 'principal');
  const interests = aggregateMonthly(tracks, maxMonths, 'interest');
  const totalCost = sumMoney(tracks.map((track) => track.totalCost));

  return {
    tracks,
    firstPayment: payments[0]?.value ?? 0,
    averagePayment: averageMoney(payments.map((point) => point.value)),
    maxPayment: payments.length ? Math.max(...payments.map((point) => point.value)) : 0,
    maxPaymentMonth: peakMonth(payments),
    totalInterest: sumMoney(tracks.map((track) => track.totalInterest)),
    totalIndexation: sumMoney(tracks.map((track) => track.totalIndexation)),
    totalCost,
    costPerShekel: costPerShekel(totalCost, input.mortgageAmount),
    weightedRatePct: weightedAnnualRatePct(input.tracks),
    ltv: calculateLtv(input.propertyValue, input.mortgageAmount),
    paymentCurve: payments,
    balanceCurve: balances,
    principalCurve: principals,
    interestCurve: interests,
    balanceAt: {
      y5: balanceAtCurve(balances, 60),
      y10: balanceAtCurve(balances, 120),
      y15: balanceAtCurve(balances, 180),
    },
  };
}

function aggregateMonthly(
  tracks: ReadonlyArray<TrackResult>,
  maxMonths: number,
  field: 'payment' | 'closingBalance' | 'principal' | 'interest',
): ReadonlyArray<CurvePoint> {
  return Array.from({ length: maxMonths }, (_, index) => ({
    monthIndex: index + 1,
    value: sumMoney(tracks.map((track) => track.rows[index]?.[field] ?? 0)),
  }));
}

function balanceAtCurve(curve: ReadonlyArray<CurvePoint>, month: number): MoneyAgorot {
  return curve[Math.min(month, curve.length) - 1]?.value ?? 0;
}
