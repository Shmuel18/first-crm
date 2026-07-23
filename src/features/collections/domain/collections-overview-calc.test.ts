import { describe, expect, it } from 'vitest';

import {
  collectionTotals,
  enrichCollectionRow,
  enrichCollectionRows,
  primaryBorrowerName,
  selectVisibleRows,
} from './collections-overview-calc';
import type { CollectionOverviewRow } from '../types';

function row(over: Partial<CollectionOverviewRow> = {}): CollectionOverviewRow {
  return {
    caseId: 'c1',
    caseNumber: '1001',
    borrowers: 'ישראל ישראלי',
    caseStatus: 'documents',
    feeAmount: 40000,
    advanceAmount: 5000,
    collected: 0,
    expenses: 1000,
    paymentCount: 0,
    lastPaymentOn: null,
    ...over,
  };
}

describe('enrichCollectionRow', () => {
  it('pre-execution: only the advance portion of the fee is due', () => {
    const r = enrichCollectionRow(row());
    expect(r.feeBalance).toBe(5000);
    expect(r.expenseBalance).toBe(1000);
    expect(r.status).toBe('not_started');
  });

  it('at execution the whole fee becomes due', () => {
    const r = enrichCollectionRow(row({ caseStatus: 'execution' }));
    expect(r.feeBalance).toBe(40000);
    expect(r.expenseBalance).toBe(1000);
  });

  it('is "collected" once everything CURRENTLY due is in, not the lifetime fee', () => {
    // 6000 covers expenses(1000) + advance(5000) → nothing due now, even though
    // 35000 of the fee only becomes collectible at execution.
    const r = enrichCollectionRow(row({ collected: 6000 }));
    expect(r.feeBalance).toBe(0);
    expect(r.expenseBalance).toBe(0);
    expect(r.status).toBe('collected');
  });

  it('is "partial" while something due is still outstanding', () => {
    // Payments cover expenses first: 1000 clears expenses, advance stays due.
    const r = enrichCollectionRow(row({ collected: 1000 }));
    expect(r.feeBalance).toBe(5000);
    expect(r.status).toBe('partial');
  });

  it('is "overpaid" only past the full agreed value (fee + expenses)', () => {
    expect(enrichCollectionRow(row({ collected: 41000 })).status).toBe('collected');
    expect(enrichCollectionRow(row({ collected: 41001 })).status).toBe('overpaid');
  });

  it('treats a null fee/advance as zero', () => {
    const r = enrichCollectionRow(row({ feeAmount: null, advanceAmount: null }));
    expect(r.feeBalance).toBe(0);
    expect(r.expenseBalance).toBe(1000);
  });

  it('carries the source row through untouched', () => {
    const src = row({ caseNumber: '2002' });
    expect(enrichCollectionRow(src)).toMatchObject(src);
  });
});

describe('collectionTotals', () => {
  it('open === feeOpen + expensesOpen by construction', () => {
    const totals = collectionTotals(
      enrichCollectionRows([row(), row({ caseId: 'c2', caseStatus: 'execution' })]),
    );
    expect(totals.open).toBe(totals.feeOpen + totals.expensesOpen);
  });

  it('sums collected and GROSS expenses across rows', () => {
    const totals = collectionTotals(
      enrichCollectionRows([
        row({ collected: 2000 }),
        row({ caseId: 'c2', collected: 500, expenses: 300 }),
      ]),
    );
    expect(totals.collected).toBe(2500);
    expect(totals.expenses).toBe(1300);
  });

  it('feeGross counts only what is CURRENTLY collectible (advance, or the full fee at execution)', () => {
    const totals = collectionTotals(
      enrichCollectionRows([row(), row({ caseId: 'c2', caseStatus: 'execution' })]),
    );
    expect(totals.feeGross).toBe(5000 + 40000);
  });

  it('clamps feeGross to the fee when the advance exceeds it', () => {
    const totals = collectionTotals(enrichCollectionRows([row({ feeAmount: 3000, advanceAmount: 9000 })]));
    expect(totals.feeGross).toBe(3000);
  });
});

describe('selectVisibleRows', () => {
  const rows = enrichCollectionRows([
    row({ caseId: 'due-small' }), // 6000 outstanding
    row({ caseId: 'due-big', caseStatus: 'execution' }), // 41000 outstanding
    row({ caseId: 'settled', collected: 6000 }), // nothing due
  ]);

  it('"open" keeps only rows with an outstanding balance', () => {
    expect(selectVisibleRows(rows, 'open').map((r) => r.caseId)).toEqual(['due-big', 'due-small']);
  });

  it('"all" keeps everything, most outstanding first', () => {
    expect(selectVisibleRows(rows, 'all').map((r) => r.caseId)).toEqual([
      'due-big',
      'due-small',
      'settled',
    ]);
  });

  it('a status filter matches on the derived status', () => {
    expect(selectVisibleRows(rows, 'collected').map((r) => r.caseId)).toEqual(['settled']);
    expect(selectVisibleRows(rows, 'not_started').map((r) => r.caseId)).toEqual([
      'due-big',
      'due-small',
    ]);
  });

  it('does not mutate the input order', () => {
    const before = rows.map((r) => r.caseId);
    selectVisibleRows(rows, 'all');
    expect(rows.map((r) => r.caseId)).toEqual(before);
  });
});

describe('primaryBorrowerName', () => {
  it('leads with the primary borrower (first in the comma-joined list)', () => {
    expect(primaryBorrowerName({ borrowers: 'שרה כהן, דוד כהן', caseNumber: '1001' })).toBe('שרה כהן');
  });
  it('falls back to the case number when there are no borrowers', () => {
    expect(primaryBorrowerName({ borrowers: null, caseNumber: '1001' })).toBe('1001');
    expect(primaryBorrowerName({ borrowers: '', caseNumber: '1001' })).toBe('1001');
  });
});
