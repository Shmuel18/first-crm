'use client';

import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useExpenseRows } from '../hooks/use-expense-rows';
import { CaseExpenseRow } from './case-expense-row';
import type { CaseExpenseRow as CaseExpenseRowData } from '../types';

type Props = {
  caseId: string;
  expenses: ReadonlyArray<CaseExpenseRowData>;
  canEdit: boolean;
};

/**
 * Compact expenses list embedded inside the admin block. Three columns
 * (date / amount / description) plus per-row delete. The "+ הוסף הוצאה"
 * affordance is a small text link at the bottom — expenses are a side
 * detail in the admin block, not a primary block.
 *
 * All state lives in useExpenseRows (optimistic add / delete / blur-save +
 * a debounced background router.refresh so the router cache never keeps
 * serving the pre-mutation page); this component only renders.
 */
export function CaseExpensesList({ caseId, expenses, canEdit }: Props) {
  const t = useTranslations('expenses');
  const tf = useTranslations('expenses.fields');
  const {
    rows,
    isAdding,
    addRow,
    deleteRow,
    saveField,
    rowKey,
    onReceiptMutateStart,
    onReceiptMutateSettled,
  } = useExpenseRows(caseId, expenses);

  const addButton = canEdit ? (
    <button
      type="button"
      onClick={addRow}
      disabled={isAdding}
      className="inline-flex items-center gap-1 text-xs font-medium text-brand-gold-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 rounded disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isAdding ? (
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="size-3" aria-hidden="true" />
      )}
      {t('addExpense')}
    </button>
  ) : null;

  if (rows.length === 0) {
    return (
      <div className="py-2 text-xs text-neutral-500 flex items-center justify-between gap-3">
        <span className="italic">{t('empty')}</span>
        {addButton}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="overflow-x-auto">
        {/* table-fixed + colgroup: pins each column so the native date input's
            large intrinsic width can't swallow the row and squeeze amount /
            description off-screen on mobile. Description takes the remainder. */}
        <table className="w-full text-sm border-separate border-spacing-0 table-fixed">
          <colgroup>
            <col className="w-32" />
            <col className="w-24" />
            <col />
            <col className="w-14" />
          </colgroup>
          <thead>
            <tr className="text-start">
              <Th>{tf('expenseDate')}</Th>
              <Th>{tf('amount')}</Th>
              <Th>{tf('description')}</Th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {rows.map((ex) => (
              <CaseExpenseRow
                key={rowKey(ex.id)}
                caseId={caseId}
                expense={ex}
                canEdit={canEdit}
                onSaveField={(field, value) => saveField(ex.id, field, value)}
                onDelete={() => deleteRow(ex.id)}
                onReceiptMutateStart={onReceiptMutateStart}
                onReceiptMutateSettled={onReceiptMutateSettled}
              />
            ))}
          </tbody>
        </table>
      </div>
      {/* Add link as a thin footer instead of a heavy header — keeps the
          expenses section visually subordinate to the case-details fields
          above it. */}
      <div className="flex items-center justify-end pt-1">{addButton}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-1.5 py-1.5 text-xs font-medium text-neutral-600 text-start border-b border-neutral-200"
    >
      {children}
    </th>
  );
}
