import { describe, expect, it } from 'vitest';

import {
  caseCollectionSummary,
  collectionBalance,
  collectionProgressPct,
  collectionStatus,
  expenseBalance,
  feeBalanceDue,
  netProfit,
  outstandingBalance,
  sumCollected,
} from './collections-calc';

describe('sumCollected', () => {
  it('sums finite amounts and ignores non-finite ones', () => {
    expect(sumCollected([1000, 2500, 500])).toBe(4000);
    expect(sumCollected([1000, NaN, Infinity, 500])).toBe(1500);
    expect(sumCollected([])).toBe(0);
  });
});

describe('collectionBalance', () => {
  it('returns the remaining fee', () => {
    expect(collectionBalance(10000, 4000)).toBe(6000);
  });
  it('goes negative when overpaid', () => {
    expect(collectionBalance(10000, 12000)).toBe(-2000);
  });
  it('is 0 when the agreed fee is null or non-positive', () => {
    expect(collectionBalance(null, 4000)).toBe(0);
    expect(collectionBalance(0, 4000)).toBe(0);
  });
});

describe('collectionStatus', () => {
  it('not_started when nothing collected', () => {
    expect(collectionStatus(10000, 0)).toBe('not_started');
  });
  it('partial when some but not all collected', () => {
    expect(collectionStatus(10000, 4000)).toBe('partial');
  });
  it('collected when the full fee is in', () => {
    expect(collectionStatus(10000, 10000)).toBe('collected');
  });
  it('overpaid when collected exceeds the fee', () => {
    expect(collectionStatus(10000, 12000)).toBe('overpaid');
  });
  it('partial when money came in against an unset fee', () => {
    expect(collectionStatus(null, 4000)).toBe('partial');
    expect(collectionStatus(null, 0)).toBe('not_started');
  });
});

describe('collectionProgressPct', () => {
  it('is a clamped 0–100 percentage', () => {
    expect(collectionProgressPct(10000, 0)).toBe(0);
    expect(collectionProgressPct(10000, 2500)).toBe(25);
    expect(collectionProgressPct(10000, 10000)).toBe(100);
    expect(collectionProgressPct(10000, 15000)).toBe(100);
  });
  it('treats any collection against a null fee as full', () => {
    expect(collectionProgressPct(null, 500)).toBe(100);
    expect(collectionProgressPct(null, 0)).toBe(0);
  });
});

describe('netProfit', () => {
  it('subtracts expenses from collected', () => {
    expect(netProfit(10000, 1500)).toBe(8500);
    expect(netProfit(1000, 1500)).toBe(-500);
  });
});

describe('feeBalanceDue (advance is part of the fee)', () => {
  // fee 40000, advance 5000 (of the fee), expenses 1000.
  it('pre-execution: only the advance portion of the fee is due', () => {
    expect(feeBalanceDue(40000, 5000, 1000, 0, false)).toBe(5000);
  });
  it('pre-execution: paying expenses + advance clears the fee-due (no phantom balance)', () => {
    // The bug this fixes: 6000 covers expenses(1000)+advance(5000) → 0 due, not 5000.
    expect(feeBalanceDue(40000, 5000, 1000, 6000, false)).toBe(0);
  });
  it('at execution: the whole fee is due, less payments beyond expenses', () => {
    expect(feeBalanceDue(40000, 5000, 1000, 6000, true)).toBe(35000);
  });
  it('no advance configured pre-execution → nothing of the fee is due yet', () => {
    expect(feeBalanceDue(40000, 0, 0, 0, false)).toBe(0);
  });
  it('advance is clamped to the fee (never exceeds it)', () => {
    expect(feeBalanceDue(3000, 9000, 0, 0, false)).toBe(3000);
  });
  it('payments cover expenses first, so a small payment leaves the advance mostly due', () => {
    // 1000 fully absorbed by expenses → advance still 5000 due pre-execution.
    expect(feeBalanceDue(40000, 5000, 1000, 1000, false)).toBe(5000);
  });
});

describe('outstandingBalance (advance folded into the fee, never added on top)', () => {
  it('pre-execution: advance + unpaid expenses', () => {
    expect(outstandingBalance(40000, 5000, 1000, 0, false)).toBe(6000);
  });
  it('pre-execution: fully paid upfront → 0 (was inflated by the advance before the fix)', () => {
    expect(outstandingBalance(40000, 5000, 1000, 6000, false)).toBe(0);
  });
  it('at execution: full fee + expenses, less collected', () => {
    expect(outstandingBalance(40000, 5000, 1000, 0, true)).toBe(41000);
  });
  it('equals feeBalanceDue + expenseBalance by construction', () => {
    const [fee, adv, exp, col, exec] = [40000, 5000, 1000, 3000, true] as const;
    expect(outstandingBalance(fee, adv, exp, col, exec)).toBe(
      feeBalanceDue(fee, adv, exp, col, exec) + expenseBalance(exp, col),
    );
  });
});

describe('caseCollectionSummary', () => {
  it('reports the balance due now, against the full agreed value as the base', () => {
    // fee 40000 + expenses 1000 = 41000 agreed; pre-execution only 6000 is due.
    const s = caseCollectionSummary(40000, 5000, 1000, 0, false);
    expect(s.balance).toBe(6000);
    expect(s.totalAgreed).toBe(41000);
    expect(s.hasOwed).toBe(true);
    expect(s.met).toBe(false);
    expect(s.pct).toBe(0);
  });

  it('pct measures against the agreed value, so it does NOT jump at execution', () => {
    const pre = caseCollectionSummary(40000, 5000, 1000, 6000, false);
    const post = caseCollectionSummary(40000, 5000, 1000, 6000, true);
    expect(pre.pct).toBe(15); // 6000 / 41000
    expect(post.pct).toBe(15);
    // The balance DOES move — that's "due now", which is the point.
    expect(pre.balance).toBe(0);
    expect(post.balance).toBe(35000);
  });

  it('met once everything currently due is in', () => {
    expect(caseCollectionSummary(40000, 5000, 1000, 6000, false).met).toBe(true);
    expect(caseCollectionSummary(40000, 5000, 1000, 5999, false).met).toBe(false);
  });

  it('falls back to collected+balance as the base when no fee/expenses are set', () => {
    const s = caseCollectionSummary(null, 0, 0, 2000, false);
    expect(s.totalAgreed).toBe(0);
    expect(s.hasOwed).toBe(false);
    expect(s.met).toBe(false); // nothing owed → nothing "met"
    expect(s.pct).toBe(100); // 2000 / (2000 + 0)
  });

  it('pct is clamped to 0–100 when overpaid', () => {
    expect(caseCollectionSummary(10000, 10000, 0, 15000, true).pct).toBe(100);
  });
});
