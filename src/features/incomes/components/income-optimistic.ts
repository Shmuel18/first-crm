import type { BorrowerIncomesGroup, IncomeWithType } from '../types';

/** Client-owned per-borrower income group (the optimistic mirror of the
 *  server's BorrowerIncomesGroup, minus the derived monthlyTotal which the
 *  client recomputes from `incomes`). */
export type IncomeGroupState = {
  borrowerId: string;
  borrowerName: string;
  incomes: IncomeWithType[];
};

/** Map the server groups into mutable client state. */
export function toIncomeGroupState(
  groups: ReadonlyArray<BorrowerIncomesGroup>,
): IncomeGroupState[] {
  return groups.map((g) => ({
    borrowerId: g.borrowerId,
    borrowerName: g.borrowerName,
    incomes: [...g.incomes],
  }));
}

/** Stable signature of the server groups — when it changes we resync client
 *  state to server truth (covers a revalidate elsewhere). */
export function buildIncomesSignature(groups: ReadonlyArray<BorrowerIncomesGroup>): string {
  return groups
    .map(
      (g) =>
        g.borrowerId +
        ':' +
        g.incomes
          .map(
            (i) =>
              `${i.id}#${i.amount_monthly ?? ''}#${i.income_type_id ?? ''}#${i.source_name ?? ''}#${i.employment_start_date ?? ''}#${i.tenure_months ?? ''}`,
          )
          .join(','),
    )
    .join('|');
}

/** Replace one income (matched by id) within its borrower's group. */
export function mapIncome(
  groups: IncomeGroupState[],
  borrowerId: string,
  incomeId: string,
  fn: (income: IncomeWithType) => IncomeWithType,
): IncomeGroupState[] {
  return groups.map((g) =>
    g.borrowerId === borrowerId
      ? { ...g, incomes: g.incomes.map((i) => (i.id === incomeId ? fn(i) : i)) }
      : g,
  );
}

/** Transform the income array of one borrower's group (add / remove / reorder). */
export function mapGroupIncomes(
  groups: IncomeGroupState[],
  borrowerId: string,
  fn: (incomes: IncomeWithType[]) => IncomeWithType[],
): IncomeGroupState[] {
  return groups.map((g) => (g.borrowerId === borrowerId ? { ...g, incomes: fn(g.incomes) } : g));
}

/**
 * Blank income (joined shape) for an optimistic insert — mirrors what
 * createEmptyIncomeAction persists (only borrower_id set, the rest defaulted).
 * created_at / updated_at are placeholders the next server resync overwrites.
 */
export function emptyIncomeRow(id: string, borrowerId: string): IncomeWithType {
  return {
    id,
    borrower_id: borrowerId,
    amount_monthly: null,
    created_at: '',
    created_by: null,
    deleted_at: null,
    deleted_by: null,
    employment_start_date: null,
    income_type_id: null,
    is_primary: false,
    metadata: {},
    notes: null,
    source_name: null,
    tenure_months: null,
    updated_at: '',
    updated_by: null,
    income_type: null,
  };
}
