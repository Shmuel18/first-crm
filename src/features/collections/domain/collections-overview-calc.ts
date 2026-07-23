import type { CollectionOverviewRow, CollectionStatus } from '../types';
import { expenseBalance, feeBalanceDue, sumCollected } from './collections-calc';

// ---------------------------------------------------------------------------
// Row/total derivation for the central /collections dashboard. Pure — the
// balance primitives it composes live in collections-calc and are shared with
// the in-case מנהלה block, so the two screens can never disagree.
// ---------------------------------------------------------------------------

// 'open' (an outstanding balance — the cases still to collect from) leads and is
// the default view, so the dashboard always foregrounds what's left to collect.
export const COLLECTION_FILTERS = [
  'open',
  'all',
  'not_started',
  'partial',
  'collected',
  'overpaid',
] as const;
export type CollectionFilter = (typeof COLLECTION_FILTERS)[number];

/** A dashboard row with its balances and status derived. */
export type EnrichedCollectionRow = CollectionOverviewRow & {
  expenseBalance: number;
  feeBalance: number;
  status: CollectionStatus;
};

/** The dashboard's headline figures (₪). */
export type CollectionTotals = {
  collected: number;
  expenses: number;
  feeGross: number;
  feeOpen: number;
  expensesOpen: number;
  open: number;
};

/** Derives one row's fee/expense balances and its collection status. */
export function enrichCollectionRow(r: CollectionOverviewRow): EnrichedCollectionRow {
  // Payments cover expenses first, then the fee-due. The advance is the
  // upfront PORTION OF the fee (mig 212 semantics), so pre-execution it IS
  // the fee-due and at execution the whole fee is — it's never added on top
  // (that double-counted it). Shared with the מנהלה block via the helpers.
  const expenseBal = expenseBalance(r.expenses, r.collected);
  const feeBal = feeBalanceDue(
    r.feeAmount,
    r.advanceAmount ?? 0,
    r.expenses,
    r.collected,
    r.caseStatus === 'execution',
  );

  // Status reflects whether everything *currently due* has been collected —
  // not whether the full lifetime fee has been paid. A case whose expenses
  // + advance are covered is "collected" even if the rest of the fee kicks
  // in later at execution.
  const outstanding = feeBal + expenseBal;
  const totalAgreed = (r.feeAmount ?? 0) + r.expenses;
  const status: CollectionStatus =
    r.collected <= 0 ? 'not_started'
    : totalAgreed > 0 && r.collected > totalAgreed ? 'overpaid'
    : outstanding <= 0 ? 'collected'
    : 'partial';

  return { ...r, expenseBalance: expenseBal, feeBalance: feeBal, status };
}

export function enrichCollectionRows(
  rows: ReadonlyArray<CollectionOverviewRow>,
): EnrichedCollectionRow[] {
  return rows.map(enrichCollectionRow);
}

/**
 * The open balance is split into fee vs expenses so the headline is auditable
 * — "how much of the total is fee and how much is expenses". open === feeOpen
 * + expensesOpen by construction (the advance is folded into the fee, never a
 * third bucket). `expenses` stays the GROSS office spend (≠ expensesOpen, which
 * nets out what's collected) and rides as a hint under the expenses card.
 *
 * Each "to collect" card carries its GROSS counterpart as a hint, so the gap
 * reads the same on both: money already collected. feeGross is the fee that is
 * CURRENTLY collectible — the full fee at execution, only the advance before it
 * — matching feeBalanceDue. Summing fee_amount across all cases would make the
 * gap mean "collected + not due yet", two different things under one label.
 */
export function collectionTotals(rows: ReadonlyArray<EnrichedCollectionRow>): CollectionTotals {
  const collected = sumCollected(rows.map((r) => r.collected));
  const expenses = sumCollected(rows.map((r) => r.expenses));
  const feeOpen = sumCollected(rows.map((r) => r.feeBalance));
  const expensesOpen = sumCollected(rows.map((r) => r.expenseBalance));
  const feeGross = sumCollected(
    rows.map((r) =>
      r.caseStatus === 'execution'
        ? r.feeAmount ?? 0
        : Math.min(r.advanceAmount ?? 0, r.feeAmount ?? 0),
    ),
  );
  return {
    collected,
    expenses,
    feeGross,
    feeOpen,
    expensesOpen,
    open: feeOpen + expensesOpen,
  };
}

/** Applies the status filter, then orders by what's most outstanding. */
export function selectVisibleRows(
  rows: ReadonlyArray<EnrichedCollectionRow>,
  filter: CollectionFilter,
): EnrichedCollectionRow[] {
  return (
    filter === 'all'
      ? rows
      : filter === 'open'
        ? rows.filter((r) => r.feeBalance > 0 || r.expenseBalance > 0)
        : rows.filter((r) => r.status === filter)
  )
    .slice()
    // Most outstanding overall first — highest collector priority at the top.
    .sort((a, b) => (b.feeBalance + b.expenseBalance) - (a.feeBalance + a.expenseBalance));
}

/**
 * Who to name in the "record payment" dialog. Leads with the primary borrower
 * (borrowers is ordered is_primary first); falls back to the case number.
 */
export function primaryBorrowerName(
  row: Pick<CollectionOverviewRow, 'borrowers' | 'caseNumber'>,
): string {
  return row.borrowers ? (row.borrowers.split(', ')[0] ?? row.borrowers) : row.caseNumber;
}
