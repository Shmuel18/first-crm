import { averageMoney, sumMoney } from './money';

import type { AmortizationRow, MoneyAgorot, TrackResult } from '../types';

export function summarizeTrack(
  trackId: string,
  rows: ReadonlyArray<AmortizationRow>,
): TrackResult {
  const payments = rows.map((row) => row.payment);
  return {
    trackId,
    rows,
    firstPayment: payments[0] ?? 0,
    averagePayment: averageMoney(payments),
    maxPayment: payments.length ? Math.max(...payments) : 0,
    totalInterest: sumMoney(rows.map((row) => row.interest)),
    totalIndexation: sumMoney(rows.map((row) => row.indexation)),
    totalCost: sumMoney(payments),
    balanceAt: {
      y5: balanceAt(rows, 60),
      y10: balanceAt(rows, 120),
      y15: balanceAt(rows, 180),
    },
  };
}

export function balanceAt(
  rows: ReadonlyArray<AmortizationRow>,
  month: number,
): MoneyAgorot {
  const row = rows[Math.min(month, rows.length) - 1];
  return row?.closingBalance ?? 0;
}

