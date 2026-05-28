import { applyMonthlyIndexation } from './cpi-indexation';
import { roundAgorot } from './money';
import { closeMonth } from './payment';
import { effectiveAnnualRatePct, monthlyRate } from './rate';

import type { AmortizationRow, MoneyAgorot, TrackInput } from '../types';

export function buildEqualPrincipalSchedule(track: TrackInput): ReadonlyArray<AmortizationRow> {
  const rows: AmortizationRow[] = [];
  const rate = monthlyRate(effectiveAnnualRatePct(track));
  let balance: MoneyAgorot = track.amount;

  for (let month = 1; month <= track.termMonths && balance > 0; month += 1) {
    const indexed = applyMonthlyIndexation(balance, track.cpiAnnualPct);
    const remaining = track.termMonths - month + 1;
    const interest = roundAgorot(indexed.balance * rate);
    const targetPrincipal = roundAgorot(indexed.balance / remaining);
    const closed = closeMonth(indexed.balance, interest, targetPrincipal);
    rows.push({ monthIndex: month, interest, indexation: indexed.indexation, ...closed });
    balance = closed.closingBalance;
  }

  return rows;
}

