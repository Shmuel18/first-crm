'use client';

import { useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useInlineMutationSync } from '@/lib/hooks/use-inline-mutation-sync';
import { useOptimisticIds } from '@/lib/hooks/use-optimistic-ids';
import { useSyncedRows } from '@/lib/hooks/use-synced-rows';
import { reinsertAt } from '@/lib/utils/reinsert-at';

import { createEmptyPayoutAction } from '../actions/create-empty-payout';
import { deletePayoutAction } from '../actions/delete-payout';
import { updatePayoutFieldAction, type EditablePayoutField } from '../actions/update-payout-field';
import { emptyPayoutRow } from '../domain/case-payout-empty-row';
import type { CasePayoutRow } from '../types';

type UsePayoutRowsResult = {
  rows: CasePayoutRow[];
  isAdding: boolean;
  addRow: () => void;
  deleteRow: (id: string) => void;
  saveField: (id: string, field: EditablePayoutField, value: unknown) => void;
  /** Stable React key — survives the temp -> real id swap (no remount). */
  rowKey: (id: string) => string;
};

/**
 * Optimistic state (add / delete / inline blur-save) for CasePayoutsList.
 * Mirrors useExpenseRows: useInlineMutationSync keeps the router cache from
 * serving the pre-mutation page after FE-1 mutations, useOptimisticIds routes
 * blur-saves/deletes that beat the row's insert to the real id.
 */
export function usePayoutRows(
  caseId: string,
  payouts: ReadonlyArray<CasePayoutRow>,
): UsePayoutRowsResult {
  const tc = useTranslations('common');
  const [isAdding, startAdd] = useTransition();
  const { pendingCount, refreshOwed, beginOp, endOp, refreshSoon } = useInlineMutationSync();
  const { newTempId, registerCreate, resolveRealId, markCreated, rowKey } = useOptimisticIds();

  const sig = payouts.map((p) => `${p.id}:${p.recipient ?? ''}:${p.amount ?? ''}`).join('|');
  const [rows, setRows] = useSyncedRows(sig, () => [...payouts], pendingCount === 0 && !refreshOwed);

  const addRow = (): void => {
    const tempId = newTempId();
    setRows((prev) => [...prev, emptyPayoutRow(tempId, caseId)]);
    beginOp();
    const created = createEmptyPayoutAction(caseId)
      .then((result) => (result.ok ? result.payoutId : null))
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

  const saveField = (id: string, field: EditablePayoutField, value: unknown): void => {
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
        const result = await updatePayoutFieldAction(realId, caseId, field, value);
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
          const result = await deletePayoutAction(realId, caseId);
          if (!result.ok) throw new Error(result.error);
          refreshSoon();
        }
      } catch {
        setRows((prev) => reinsertAt(prev, index, removed));
        toast.error(tc('saveFailed'));
        refreshSoon();
      } finally {
        endOp();
      }
    })();
  };

  return { rows, isAdding, addRow, deleteRow, saveField, rowKey };
}
