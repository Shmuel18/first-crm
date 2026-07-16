'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useInlineMutationSync } from '@/lib/hooks/use-inline-mutation-sync';

import { updateCaseFeeAmountAction } from '../actions/update-case-fee-amount';
import { updateCaseFeePaidAction } from '../actions/update-case-fee-paid';
import { updateCaseFieldAction } from '../actions/update-case-field';
import { isEditableCaseField, type EditableCaseField } from '../domain/editable-case-fields';
import type { CaseRow } from '../types';

export type LocalCase = Pick<
  CaseRow,
  | 'status_id'
  | 'assigned_advisor_id'
  | 'case_blocker'
  | 'insurance_status'
  | 'insurance_agent_name'
  | 'appraiser_name'
  | 'target_date'
  | 'referrer_name'
  | 'short_note'
>;

type SaveResult = { ok: true } | { ok: false; message?: string };

/**
 * Optimistic state + save handlers for the "פרטי התיק" fields. Wired into
 * useInlineMutationSync so every save schedules a background router.refresh —
 * without it the router cache kept the pre-edit payload and a back/forward
 * navigation showed stale field values; editing on top of that stale view
 * OVERWROTE newer content (seen in prod audit_log on short_note). Resyncs
 * from props are gated the same way so a stale payload can't revert a cell.
 */
export function useCaseDetailsState(
  caseId: string,
  initial: LocalCase,
  initialFeeAmount: number | null,
  initialFeePaid: boolean,
  initialFeePaidAt: string | null,
) {
  const tc = useTranslations('common');
  const { pendingCount, refreshOwed, beginOp, endOp, refreshSoon } = useInlineMutationSync();
  const canApplyResync = pendingCount === 0 && !refreshOwed;

  const [localCase, setLocalCase] = useState<LocalCase>(initial);
  const initialSig = JSON.stringify(initial);
  const [caseRef, setCaseRef] = useState(initialSig);
  if (initialSig !== caseRef) {
    setCaseRef(initialSig);
    if (canApplyResync) setLocalCase(initial);
  }

  const [localFee, setLocalFee] = useState<number | null>(initialFeeAmount);
  const [feeRef, setFeeRef] = useState<number | null>(initialFeeAmount);
  if (initialFeeAmount !== feeRef) {
    setFeeRef(initialFeeAmount);
    if (canApplyResync) setLocalFee(initialFeeAmount);
  }

  const [localPaid, setLocalPaid] = useState<boolean>(initialFeePaid);
  const [localPaidAt, setLocalPaidAt] = useState<string | null>(initialFeePaidAt);
  const [paidRef, setPaidRef] = useState<boolean>(initialFeePaid);
  if (initialFeePaid !== paidRef) {
    setPaidRef(initialFeePaid);
    if (canApplyResync) {
      setLocalPaid(initialFeePaid);
      setLocalPaidAt(initialFeePaidAt);
    }
  }

  const saveField = async (field: EditableCaseField, value: string | null): Promise<SaveResult> => {
    if (!isEditableCaseField(field)) return { ok: false };
    // Cast to LocalCase keys — only the admin-section fields reach here; the
    // wider EditableCaseField type shares the action contract with the
    // property block.
    const key = field as keyof LocalCase;
    const prev = localCase[key];
    setLocalCase((c) => ({ ...c, [key]: value as never }));
    beginOp();
    try {
      const result = await updateCaseFieldAction(caseId, field, value);
      if (!result.ok) {
        setLocalCase((c) => ({ ...c, [key]: prev as never }));
        return { ok: false, message: result.message };
      }
      return { ok: true };
    } catch {
      setLocalCase((c) => ({ ...c, [key]: prev as never }));
      return { ok: false };
    } finally {
      endOp();
      refreshSoon();
    }
  };

  const saveFee = async (value: string | null): Promise<SaveResult> => {
    const prev = localFee;
    setLocalFee(value === null || value === '' ? null : Number(value));
    beginOp();
    try {
      const result = await updateCaseFeeAmountAction(caseId, value);
      if (!result.ok) {
        setLocalFee(prev);
        return { ok: false, message: result.message };
      }
      return { ok: true };
    } catch {
      setLocalFee(prev);
      return { ok: false };
    } finally {
      endOp();
      refreshSoon();
    }
  };

  const savePaid = (checked: boolean): void => {
    const prevPaid = localPaid;
    const prevAt = localPaidAt;
    setLocalPaid(checked);
    setLocalPaidAt(checked ? new Date().toISOString() : null);
    beginOp();
    void updateCaseFeePaidAction(caseId, checked)
      .then((res) => {
        if (!res.ok) {
          setLocalPaid(prevPaid);
          setLocalPaidAt(prevAt);
          toast.error(tc('saveFailed'));
        } else {
          setLocalPaidAt(res.paidAt);
        }
      })
      .catch(() => {
        setLocalPaid(prevPaid);
        setLocalPaidAt(prevAt);
        toast.error(tc('saveFailed'));
      })
      .finally(() => {
        endOp();
        refreshSoon();
      });
  };

  return { localCase, localFee, localPaid, localPaidAt, saveField, saveFee, savePaid };
}
