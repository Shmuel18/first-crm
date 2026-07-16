'use client';

import { useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useInlineMutationSync } from '@/lib/hooks/use-inline-mutation-sync';
import { useOptimisticIds } from '@/lib/hooks/use-optimistic-ids';
import { useSyncedRows } from '@/lib/hooks/use-synced-rows';
import { reinsertAt } from '@/lib/utils/reinsert-at';

import { createEmptyObligationAction } from '../actions/create-empty-obligation';
import { deleteObligationAction } from '../actions/delete-obligation';
import {
  updateObligationFieldAction,
  type EditableObligationField,
} from '../actions/update-obligation-field';
import { monthsUntil } from '../domain/months-remaining';
import { emptyObligationRow } from '../domain/obligation-empty-row';
import type { ObligationRow } from '../types';

type UseObligationRowsResult = {
  rows: ObligationRow[];
  isAdding: boolean;
  addRow: () => void;
  deleteRow: (id: string) => void;
  saveField: (id: string, field: EditableObligationField, value: unknown) => void;
  /** Stable React key — survives the temp -> real id swap (no remount). */
  rowKey: (id: string) => string;
};

/**
 * Optimistic state (add / delete / inline blur-save) for CaseObligationsClient,
 * incl. the end_date -> months_remaining smart default. Mirrors useExpenseRows:
 * useInlineMutationSync keeps the router cache fresh (FE-1), useOptimisticIds
 * routes ops that beat the row's insert.
 */
export function useObligationRows(
  caseId: string,
  primaryBorrowerId: string | null,
  initialObligations: ReadonlyArray<ObligationRow>,
): UseObligationRowsResult {
  const t = useTranslations('obligations');
  const tc = useTranslations('common');
  const [isAdding, startAdd] = useTransition();
  const { pendingCount, refreshOwed, beginOp, endOp, refreshSoon } = useInlineMutationSync();
  const { newTempId, registerCreate, resolveRealId, markCreated, rowKey } = useOptimisticIds();

  const sig = initialObligations
    .map((r) => `${r.id}:${r.monthly_payment ?? ''}:${r.loan_amount ?? ''}:${r.end_date ?? ''}:${r.months_remaining ?? ''}:${r.lender ?? ''}`)
    .join('|');
  const [rows, setRows] = useSyncedRows(sig, () => [...initialObligations], pendingCount === 0 && !refreshOwed);

  const addRow = (): void => {
    if (!primaryBorrowerId) return;
    const tempId = newTempId();
    setRows((prev) => [...prev, emptyObligationRow(tempId, primaryBorrowerId)]);
    beginOp();
    const created = createEmptyObligationAction(caseId, primaryBorrowerId)
      .then((result) => (result.ok ? result.obligationId : null))
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

  // Patch one row by either id — the row may swap temp -> real mid-save.
  const patchRow = (id: string, realId: string | null, patch: Partial<ObligationRow>): void => {
    setRows((cur) => cur.map((r) => (r.id === id || r.id === realId ? { ...r, ...patch } : r)));
  };

  const saveField = (id: string, field: EditableObligationField, value: unknown): void => {
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
        const result = await updateObligationFieldAction(realId, caseId, field, value);
        if (!result.ok) {
          message = result.message;
          throw new Error(result.error);
        }
        // Smart default: filling end_date derives months_remaining from it (the
        // reverse is left manual). Clearing end_date leaves months as-is.
        if (field === 'end_date' && typeof value === 'string' && value) {
          const prevMonths = target.months_remaining;
          const months = monthsUntil(value);
          patchRow(id, realId, { months_remaining: months });
          const monthsResult = await updateObligationFieldAction(realId, caseId, 'months_remaining', months);
          if (!monthsResult.ok) patchRow(id, realId, { months_remaining: prevMonths });
        }
        refreshSoon();
      } catch {
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
          const result = await deleteObligationAction(realId, removed.borrower_id, caseId);
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

  return { rows, isAdding, addRow, deleteRow, saveField, rowKey };
}
