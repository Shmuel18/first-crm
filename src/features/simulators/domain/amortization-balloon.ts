import { applyMonthlyIndexation } from './cpi-indexation';
import { roundAgorot } from './money';
import { closeMonth, spitzerPayment } from './payment';
import { effectiveAnnualRatePct, monthlyRate } from './rate';

import type { AmortizationRow, MoneyAgorot, TrackInput } from '../types';

export function buildBalloonSchedule(track: TrackInput): ReadonlyArray<AmortizationRow> {
  const rows: AmortizationRow[] = [];
  const rate = monthlyRate(effectiveAnnualRatePct(track));
  const graceMonths = Math.min(track.graceMonths ?? 0, track.termMonths - 1);
  let balance: MoneyAgorot = track.amount;

  for (let month = 1; month <= track.termMonths && balance > 0; month += 1) {
    const indexed = applyMonthlyIndexation(balance, track.cpiAnnualPct);
    const interest = roundAgorot(indexed.balance * rate);
    const remaining = track.termMonths - month + 1;
    const payment = month <= graceMonths ? interest : spitzerPayment(indexed.balance, rate, remaining);
    const closed = closeMonth(indexed.balance, interest, payment - interest);
    rows.push({ monthIndex: month, interest, indexation: indexed.indexation, ...closed });
    balance = closed.closingBalance;
  }

  return rows;
}

