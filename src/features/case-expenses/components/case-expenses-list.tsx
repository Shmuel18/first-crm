'use client';

import { useState, useTransition } from 'react';

import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { createEmptyExpenseAction } from '../actions/create-empty-expense';
import { deleteExpenseAction } from '../actions/delete-expense';
import {
  updateExpenseFieldAction,
  type EditableExpenseField,
} from '../actions/update-expense-field';
import { emptyExpenseRow } from './case-expense-empty-row';
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
 * Owns the list as client state so add / delete / inline edit apply
 * optimistically — the actions no longer call revalidatePath, which used to
 * re-render the whole heavy case page and discard scroll (FE-1). Mirrors the
 * case-banks / obligations pattern; resyncs to server truth on prop change.
 */
export function CaseExpensesList({ caseId, expenses, canEdit }: Props) {
  const t = useTranslations('expenses');
  const tf = useTranslations('expenses.fields');
  const tc = useTranslations('common');
  const [isAdding, startAdd] = useTransition();

  const [rows, setRows] = useState<CaseExpenseRowData[]>(() => [...expenses]);
  const sig = expenses
    .map(
      (e) =>
        `${e.id}:${e.expense_date ?? ''}:${e.amount ?? ''}:${e.description ?? ''}:${e.receipt_name ?? ''}`,
    )
    .join('|');
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig);
    setRows([...expenses]);
  }

  const handleAdd = () => {
    if (!canEdit) return;
    const tempId = `optimistic-${prevSig.length}-${rows.length}`;
    setRows((prev) => [...prev, emptyExpenseRow(tempId, caseId)]);
    startAdd(async () => {
      const result = await createEmptyExpenseAction(caseId);
      if (!result.ok) {
        setRows((prev) => prev.filter((r) => r.id !== tempId));
        toast.error(tc('saveFailed'));
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === tempId ? { ...r, id: result.expenseId } : r)));
    });
  };

  const handleDelete = (id: string) => {
    const index = rows.findIndex((r) => r.id === id);
    const removed = rows[index];
    if (!removed) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    void deleteExpenseAction(id, caseId).then((result) => {
      if (result.ok) {
        toast.success(t('deleteSuccess'));
        return;
      }
      setRows((prev) => {
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, removed);
        return next;
      });
      toast.error(t('deleteError'));
    });
  };

  const saveField = async (id: string, field: EditableExpenseField, value: unknown) => {
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    const prev = target[field];
    // `as never` for the computed-key write: EditableExpenseField spans
    // string/number/null columns, so a dynamic [field] assignment can't be
    // proven type-safe at compile time; the action validates the field+value.
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, [field]: value as never } : r)));
    const result = await updateExpenseFieldAction(id, caseId, field, value);
    if (!result.ok) {
      setRows((cur) => cur.map((r) => (r.id === id ? { ...r, [field]: prev as never } : r)));
    }
  };

  const hasExpenses = rows.length > 0;
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
            <tr className="text-right">
              <Th>{tf('expenseDate')}</Th>
              <Th>{tf('amount')}</Th>
              <Th>{tf('description')}</Th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {rows.map((ex) => (
              <CaseExpenseRow
                key={ex.id}
                caseId={caseId}
                expense={ex}
                canEdit={canEdit}
                onSaveField={(field, value) => saveField(ex.id, field, value)}
                onDelete={() => handleDelete(ex.id)}
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
