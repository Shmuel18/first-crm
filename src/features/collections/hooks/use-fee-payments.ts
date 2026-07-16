'use client';

import { useRef, useState } from 'react';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useInlineMutationSync } from '@/lib/hooks/use-inline-mutation-sync';
import { useSyncedRows } from '@/lib/hooks/use-synced-rows';
import { reinsertAt } from '@/lib/utils/reinsert-at';

import { deleteFeePaymentAction } from '../actions/delete-fee-payment';
import { setAdvanceAmountAction } from '../actions/set-advance-amount';
import type { FeePayment } from '../types';

type UseFeePaymentsResult = {
  payments: FeePayment[];
  deletingId: string | null;
  addPayment: (payment: FeePayment) => void;
  deletePayment: (id: string) => void;
  advanceDraft: string;
  setAdvanceDraft: (next: string) => void;
  saveAdvanceDraft: () => void;
  /** Wire FeePaymentForm's server call into the same sync machinery. */
  onFormMutateStart: () => void;
  onFormMutateSettled: (ok: boolean) => void;
};

/**
 * Optimistic ledger + advance-amount state for CollectionsCompact. The
 * collections actions skip revalidatePath (FE-1), so useInlineMutationSync's
 * debounced background router.refresh keeps the router cache from restoring
 * the pre-mutation page (payments "disappearing" on back/forward).
 */
export function useFeePayments(
  caseId: string,
  initialPayments: ReadonlyArray<FeePayment>,
  initialAdvanceAmount: number | null,
): UseFeePaymentsResult {
  const t = useTranslations('collections');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { pendingCount, refreshOwed, beginOp, endOp, refreshSoon } = useInlineMutationSync();

  const sig = initialPayments
    .map((p) => `${p.id}:${p.amount}:${p.paidOn ?? ''}:${p.paymentMethod ?? ''}:${p.note ?? ''}`)
    .join('|');
  const [payments, setPayments] = useSyncedRows(
    sig,
    () => [...initialPayments],
    pendingCount === 0 && !refreshOwed,
  );

  // Local draft for the advance input (string so the field stays editable);
  // lastSaved skips no-op blurs so a mere focus-out never refreshes the page.
  const [advanceDraft, setAdvanceDraft] = useState(
    initialAdvanceAmount != null ? String(initialAdvanceAmount) : '',
  );
  const lastSavedAdvance = useRef(initialAdvanceAmount);

  const addPayment = (payment: FeePayment): void => {
    setPayments((list) => [payment, ...list]);
  };

  const deletePayment = (id: string): void => {
    const index = payments.findIndex((p) => p.id === id);
    const removed = payments[index];
    if (!removed) return;
    setPayments((list) => list.filter((p) => p.id !== id));
    setDeletingId(id);
    beginOp();
    void (async () => {
      const res = await deleteFeePaymentAction(caseId, id).catch(() => null);
      if (!res?.ok) {
        setPayments((list) => reinsertAt(list, index, removed));
        toast.error(t(`table.errors.${res?.error ?? 'unknown'}`));
      }
      refreshSoon();
      setDeletingId(null);
      endOp();
    })();
  };

  const saveAdvanceDraft = (): void => {
    const trimmed = advanceDraft.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) return;
    if (parsed === lastSavedAdvance.current) return;
    beginOp();
    void (async () => {
      const res = await setAdvanceAmountAction(caseId, parsed).catch(() => null);
      if (res?.ok) {
        lastSavedAdvance.current = parsed;
      } else {
        setAdvanceDraft(lastSavedAdvance.current != null ? String(lastSavedAdvance.current) : '');
        toast.error(t('table.errors.unknown'));
      }
      refreshSoon();
      endOp();
    })();
  };

  const onFormMutateSettled = (ok: boolean): void => {
    endOp();
    if (ok) refreshSoon();
  };

  return {
    payments,
    deletingId,
    addPayment,
    deletePayment,
    advanceDraft,
    setAdvanceDraft,
    saveAdvanceDraft,
    onFormMutateStart: beginOp,
    onFormMutateSettled,
  };
}
