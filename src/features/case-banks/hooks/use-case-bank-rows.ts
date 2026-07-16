'use client';

import { useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useInlineMutationSync } from '@/lib/hooks/use-inline-mutation-sync';
import { useOptimisticIds } from '@/lib/hooks/use-optimistic-ids';
import { useSyncedRows } from '@/lib/hooks/use-synced-rows';
import { reinsertAt } from '@/lib/utils/reinsert-at';

import { addCaseBankAction } from '../actions/add-case-bank';
import { deleteCaseBankAction } from '../actions/delete-case-bank';
import { setPrimaryBankAction } from '../actions/set-primary-bank';
import { updateCaseBankFieldAction } from '../actions/update-case-bank-field';
import type { BankOption } from '../services/case-banks.service';
import type { CaseBankRowData } from '../types';

type UseCaseBankRowsResult = {
  rows: CaseBankRowData[];
  isAdding: boolean;
  addRow: (bank: BankOption) => void;
  setPrimary: (rowId: string) => void;
  deleteRow: (rowId: string) => void;
  saveBankerName: (rowId: string, next: string | null) => void;
  /** Stable React key — survives the temp -> real id swap (no remount). */
  rowKey: (id: string) => string;
};

/**
 * Optimistic state for CaseBanksInlineList (add / delete / set-primary /
 * banker_name blur-save). Mirrors useExpenseRows: useInlineMutationSync keeps
 * the router cache fresh (FE-1), useOptimisticIds routes racing ops.
 */
export function useCaseBankRows(
  caseId: string,
  serverRows: ReadonlyArray<CaseBankRowData>,
): UseCaseBankRowsResult {
  const t = useTranslations('caseBanks');
  const tc = useTranslations('common');
  const [isAdding, startAdd] = useTransition();
  const { pendingCount, refreshOwed, beginOp, endOp, refreshSoon } = useInlineMutationSync();
  const { newTempId, registerCreate, resolveRealId, markCreated, rowKey } = useOptimisticIds();

  const sig = serverRows.map((r) => `${r.id}:${r.bank?.id ?? ''}:${r.is_primary}:${r.banker_name ?? ''}`).join('|');
  const [rows, setRows] = useSyncedRows(sig, () => [...serverRows], pendingCount === 0 && !refreshOwed);

  const addRow = (bank: BankOption): void => {
    const tempId = newTempId();
    // First bank on the case becomes primary (mirrors addCaseBankAction's rule).
    setRows((prev) => [...prev, { id: tempId, bank, banker_name: null, is_primary: rows.length === 0 }]);
    beginOp();
    const call = addCaseBankAction(caseId, bank.id).catch(() => null);
    registerCreate(tempId, call.then((r) => (r?.ok ? r.caseBankId : null)));
    startAdd(async () => {
      const result = await call;
      endOp();
      if (!result?.ok) {
        setRows((prev) => prev.filter((r) => r.id !== tempId));
        toast.error(result?.error === 'already_linked' ? t('errors.alreadyLinked') : tc('saveFailed'));
        refreshSoon();
        return;
      }
      markCreated(tempId, result.caseBankId);
      setRows((prev) => prev.map((r) => (r.id === tempId ? { ...r, id: result.caseBankId } : r)));
      refreshSoon();
    });
  };

  const setPrimary = (rowId: string): void => {
    const target = rows.find((r) => r.id === rowId);
    if (!target || target.is_primary || !target.bank) return;
    const bankId = target.bank.id;
    const prevPrimaryId = rows.find((r) => r.is_primary)?.id ?? null;
    setRows((prev) => prev.map((r) => ({ ...r, is_primary: r.id === rowId })));
    beginOp();
    void (async () => {
      try {
        // Wait out an in-flight insert so the server row exists before flagging it.
        const realId = await resolveRealId(rowId);
        const result = realId ? await setPrimaryBankAction(caseId, bankId) : null;
        if (result?.ok) { refreshSoon(); return; }
        // Roll back only the flags (a whole-array snapshot would resurrect a
        // row addRow's failure path removed — which also toasted already).
        setRows((prev) => prev.map((r) => ({ ...r, is_primary: r.id === prevPrimaryId })));
        if (realId) toast.error(tc('saveFailed'));
        refreshSoon();
      } finally {
        endOp();
      }
    })();
  };

  const deleteRow = (rowId: string): void => {
    const index = rows.findIndex((r) => r.id === rowId);
    const removed = rows[index];
    if (!removed) return;
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    beginOp();
    void (async () => {
      try {
        const realId = await resolveRealId(rowId);
        // Never-inserted row: nothing to delete server-side, addRow toasted.
        if (realId) {
          const result = await deleteCaseBankAction(realId, caseId);
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

  const saveBankerName = (rowId: string, next: string | null): void => {
    const target = rows.find((r) => r.id === rowId);
    if (!target) return;
    const prev = target.banker_name;
    setRows((cur) => cur.map((r) => (r.id === rowId ? { ...r, banker_name: next } : r)));
    beginOp();
    void (async () => {
      let realId: string | null = null;
      try {
        realId = await resolveRealId(rowId);
        // Insert failed — addRow already removed the row and toasted once.
        if (!realId) return;
        const result = await updateCaseBankFieldAction(realId, caseId, 'banker_name', next);
        if (!result.ok) throw new Error(result.error);
        refreshSoon();
      } catch {
        // Match both ids — the row may have swapped temp -> real while we awaited.
        setRows((cur) => cur.map((r) => (r.id === rowId || r.id === realId ? { ...r, banker_name: prev } : r)));
        toast.error(tc('saveFailed'));
        refreshSoon();
      } finally {
        endOp();
      }
    })();
  };

  return { rows, isAdding, addRow, setPrimary, deleteRow, saveBankerName, rowKey };
}
