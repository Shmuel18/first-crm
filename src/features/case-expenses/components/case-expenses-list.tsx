'use client';

import { useTransition } from 'react';

import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { createEmptyExpenseAction } from '../actions/create-empty-expense';
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
 * detail in the admin block, not a primary block, so no full-width
 * dashed CTA. Headers only appear when there are rows worth labeling.
 */
export function CaseExpensesList({ caseId, expenses, canEdit }: Props) {
  const t = useTranslations('expenses');
  const tf = useTranslations('expenses.fields');
  const tc = useTranslations('common');
  const [isAdding, startAdd] = useTransition();

  const handleAdd = () => {
    if (!canEdit) return;
    startAdd(async () => {
      const result = await createEmptyExpenseAction(caseId);
      if (!result.ok) toast.error(tc('saveFailed'));
    });
  };

  const hasExpenses = expenses.length > 0;
  const addButton = canEdit ? (
    <button
      type="button"
      onClick={handleAdd}
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

  if (!hasExpenses) {
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
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="text-right">
              <Th>{tf('expenseDate')}</Th>
              <Th>{tf('amount')}</Th>
              <Th>{tf('description')}</Th>
              <th aria-hidden="true" className="w-9" />
            </tr>
          </thead>
          <tbody>
            {expenses.map((ex) => (
              <CaseExpenseRow key={ex.id} caseId={caseId} expense={ex} canEdit={canEdit} />
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
