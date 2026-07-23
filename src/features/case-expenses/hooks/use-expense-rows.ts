'use client';

import { useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useInlineMutationSync } from '@/lib/hooks/use-inline-mutation-sync';
import { useOptimisticIds } from '@/lib/hooks/use-optimistic-ids';
import { useSyncedRows } from '@/lib/hooks/use-synced-rows';
import { reinsertAt } from '@/lib/utils/reinsert-at';

import { createEmptyExpenseAction } from '../actions/create-empty-expense';
import { deleteExpenseAction } from '../actions/delete-expense';
import {
  updateExpenseFieldAction,
  type EditableExpenseField,
} from '../actions/update-expense-field';
import { emptyExpenseRow } from '../domain/case-expense-empty-row';
import type { CaseExpenseRow } from '../types';

type UseExpenseRowsResult = {
  rows: CaseExpenseRow[];
  isAdding: boolean;
  addRow: () => void;
  deleteRow: (id: string) => void;
  saveField: (id: string, field: EditableExpenseField, value: unknown) => void;
  /** Stable React key — survives the temp -> real id swap (no remount). */
  rowKey: (id: string) => string;
  /** Wire the receipt cell's upload/remove into the same sync machinery. */
  onReceiptMutateStart: () => void;
  onReceiptMutateSettled: (ok: boolean) => void;
};

/**
 * Optimistic state (add / delete / inline blur-save) for CaseExpensesList,
 * closing the "wrote it but it's gone" holes that made office staff re-type
 * expenses — see useInlineMutationSync (cache refresh) and useOptimisticIds
 * (temp-id routing); every failure path rolls back AND toasts.
 */
export function useExpenseRows(
  caseId: string,
  expenses: ReadonlyArray<CaseExpenseRow>,
): UseExpenseRowsResult {
  const t = useTranslations('expenses');
  const tc = useTranslations('common');
  const [isAdding, startAdd] = useTransition();
  const { pendingCount, refreshOwed, beginOp, endOp, refreshSoon } = useInlineMutationSync();
  const { newTempId, registerCreate, resolveRealId, markCreated, rowKey } = useOptimisticIds();

  const sig = expenses
    .map((e) => `${e.id}:${e.expense_date ?? ''}:${e.amount ?? ''}:${e.description ?? ''}:${e.receipt_name ?? ''}`)
    .join('|');
  const [rows, setRows] = useSyncedRows(sig, () => [...expenses], pendingCount === 0 && !refreshOwed);

  const addRow = (): void => {
    const tempId = newTempId();
    // Pre-fill the expense date to today (a transaction date), still editable.
    // Computed at click time (not render) so there's no hydration concern, and
    // in Israel time so it matches what the office sees near midnight.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
    setRows((prev) => [...prev, emptyExpenseRow(tempId, caseId, today)]);
    beginOp();
    const created = createEmptyExpenseAction(caseId, today)
      .then((result) => (result.ok ? result.expenseId : null))
      .catch(() => null);
    registerCreate(tempId, created);
    startAdd(async () => {
      const realId = await created;
      endOp();
      if (!realId) {
        setRows((prev) => prev.filter((r) => r.id !== tempId));
        toast.error(tc('saveFailed'));
        refreshSoon();
        return;
      }
      markCreated(tempId, realId);
      setRows((prev) => prev.map((r) => (r.id === tempId ? { ...r, id: realId } : r)));
      refreshSoon();
    });
  };

  const saveField = (id: string, field: EditableExpenseField, value: unknown): void => {
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    const prev = target[field];
    // `as never`: dynamic [field] write across mixed column types; the action validates it.
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, [field]: value as never } : r)));
    beginOp();
    void (async () => {
      let realId: string | null = null;
      let message: string | undefined;
      try {
        realId = await resolveRealId(id);
        // Insert failed — addRow already removed the row and toasted once.
        if (!realId) return;
        const result = await updateExpenseFieldAction(realId, caseId, field, value);
        if (!result.ok) {
          message = result.message;
          throw new Error(result.error);
        }
        refreshSoon();
      } catch {
        // Match both ids — the row may have swapped temp -> real while we awaited.
        setRows((cur) => cur.map((r) => (r.id === id || r.id === realId ? { ...r, [field]: prev as never } : r)));
        toast.error(message ?? tc('saveFailed'));
        refreshSoon();
      } finally {
        endOp();
      }
    })();
  };

  const deleteRow = (id: string): void => {
    const index = rows.findIndex((r) => r.id === id);
    const removed = rows[index];
    if (!removed) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    beginOp();
    void (async () => {
      try {
        const realId = await resolveRealId(id);
        // Never-inserted row: nothing to delete server-side, addRow toasted.
        if (realId) {
          const result = await deleteExpenseAction(realId, caseId);
          if (!result.ok) throw new Error(result.error);
          toast.success(t('deleteSuccess'));
          refreshSoon();
        }
      } catch {
        setRows((prev) => reinsertAt(prev, index, removed));
        toast.error(t('deleteError'));
        refreshSoon();
      } finally {
        endOp();
      }
    })();
  };

  const onReceiptMutateSettled = (ok: boolean): void => {
    endOp();
    if (ok) refreshSoon();
  };

  return { rows, isAdding, addRow, deleteRow, saveField, rowKey, onReceiptMutateStart: beginOp, onReceiptMutateSettled };
}
