'use client';

import { useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useInlineMutationSync } from '@/lib/hooks/use-inline-mutation-sync';
import { useOptimisticIds } from '@/lib/hooks/use-optimistic-ids';
import { useSyncedRows } from '@/lib/hooks/use-synced-rows';
import { reinsertAt } from '@/lib/utils/reinsert-at';

import { createEmptyIncomeAction } from '../actions/create-empty-income';
import { deleteIncomeAction } from '../actions/delete-income';
import { updateIncomeFieldAction, type EditableIncomeField } from '../actions/update-income-field';
import {
  buildIncomesSignature, emptyIncomeRow, incomeTypeFor, mapGroupIncomes,
  mapIncome, mapIncomeByIds, toIncomeGroupState, type IncomeGroupState,
} from '../domain/income-optimistic';
import type { BorrowerIncomesGroup, IncomeSaveResult, IncomeTypeOption } from '../types';

type UseIncomeGroupsResult = {
  groups: IncomeGroupState[];
  isAdding: boolean;
  addIncome: (borrowerId: string) => void;
  deleteIncome: (borrowerId: string, incomeId: string) => void;
  saveField: (borrowerId: string, incomeId: string, field: EditableIncomeField, value: unknown) => Promise<IncomeSaveResult>;
  /** Stable React key — survives the temp -> real id swap (no remount). */
  rowKey: (id: string) => string;
};

/**
 * Optimistic per-borrower income lists for CaseIncomesClient (pair with
 * useEagerPrimaryIncome). Mirrors useExpenseRows: useInlineMutationSync keeps
 * the router cache from serving the pre-mutation page (FE-1),
 * useOptimisticIds routes edits/deletes that beat the row's insert.
 */
export function useIncomeGroups(
  caseId: string,
  initialGroups: ReadonlyArray<BorrowerIncomesGroup>,
  incomeTypes: ReadonlyArray<IncomeTypeOption>,
): UseIncomeGroupsResult {
  const t = useTranslations('incomes');
  const tc = useTranslations('common');
  const [isAdding, startAdd] = useTransition();
  const { pendingCount, refreshOwed, beginOp, endOp, refreshSoon } = useInlineMutationSync();
  const { newTempId, registerCreate, resolveRealId, markCreated, rowKey } = useOptimisticIds();

  const sig = buildIncomesSignature(initialGroups);
  const [groups, setGroups] = useSyncedRows(sig, () => toIncomeGroupState(initialGroups), pendingCount === 0 && !refreshOwed);

  const addIncome = (borrowerId: string): void => {
    const tempId = newTempId();
    setGroups((prev) => mapGroupIncomes(prev, borrowerId, (inc) => [...inc, emptyIncomeRow(tempId, borrowerId)]));
    beginOp();
    const created = createEmptyIncomeAction(caseId, borrowerId)
      .then((result) => (result.ok ? result.incomeId : null))
      .catch(() => null);
    registerCreate(tempId, created);
    startAdd(async () => {
      const realId = await created;
      endOp();
      if (!realId) {
        setGroups((prev) => mapGroupIncomes(prev, borrowerId, (inc) => inc.filter((i) => i.id !== tempId)));
        toast.error(tc('saveFailed'));
        refreshSoon();
        return;
      }
      markCreated(tempId, realId);
      setGroups((prev) => mapIncome(prev, borrowerId, tempId, (i) => ({ ...i, id: realId })));
      refreshSoon();
    });
  };

  const deleteIncome = (borrowerId: string, incomeId: string): void => {
    const group = groups.find((g) => g.borrowerId === borrowerId);
    const index = group?.incomes.findIndex((i) => i.id === incomeId) ?? -1;
    const removed = index >= 0 ? group?.incomes[index] : undefined;
    if (!removed) return;
    setGroups((prev) => mapGroupIncomes(prev, borrowerId, (inc) => inc.filter((i) => i.id !== incomeId)));
    beginOp();
    void (async () => {
      try {
        const realId = await resolveRealId(incomeId);
        // Never-inserted row: nothing to delete server-side, addIncome toasted.
        if (realId) {
          const result = await deleteIncomeAction(realId, borrowerId, caseId);
          if (!result.ok) throw new Error(result.error);
          toast.success(t('deleteSuccess'));
          refreshSoon();
        }
      } catch {
        setGroups((prev) => mapGroupIncomes(prev, borrowerId, (inc) => reinsertAt(inc, index, removed)));
        toast.error(t('deleteError'));
        refreshSoon();
      } finally {
        endOp();
      }
    })();
  };

  const saveField = async (
    borrowerId: string,
    incomeId: string,
    field: EditableIncomeField,
    value: unknown,
  ): Promise<IncomeSaveResult> => {
    const target = groups.find((g) => g.borrowerId === borrowerId)?.incomes.find((i) => i.id === incomeId);
    if (!target) return { ok: false };
    const prevValue = target[field];
    const prevType = target.income_type;
    // `as never`: dynamic [field] write across mixed column types; the action
    // validates it. A type change also swaps the joined income_type so the
    // card header updates without a round-trip.
    setGroups((prev) =>
      mapIncome(prev, borrowerId, incomeId, (i) => {
        const next = { ...i, [field]: value as never };
        if (field === 'income_type_id') next.income_type = incomeTypeFor(incomeTypes, value);
        return next;
      }),
    );
    beginOp();
    try {
      const realId = await resolveRealId(incomeId);
      // Insert failed — addIncome already removed the row and toasted once.
      if (!realId) return { ok: false };
      const result = await updateIncomeFieldAction(realId, caseId, field, value).catch(() => null);
      if (!result?.ok) {
        setGroups((prev) =>
          mapIncomeByIds(prev, borrowerId, [incomeId, realId], (i) => ({
            ...i,
            [field]: prevValue as never,
            income_type: field === 'income_type_id' ? prevType : i.income_type,
          })),
        );
        refreshSoon();
        return { ok: false, message: result?.message };
      }
      refreshSoon();
      return { ok: true };
    } finally {
      endOp();
    }
  };

  return { groups, isAdding, addIncome, deleteIncome, saveField, rowKey };
}
