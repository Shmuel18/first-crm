'use client';

import { useState } from 'react';

import { useInlineMutationSync } from '@/lib/hooks/use-inline-mutation-sync';

import { updateBorrowerFieldAction, type EditableBorrowerField } from '../actions/update-borrower-field';
import { updateBorrowerRoleAction } from '../actions/update-borrower-role';
import { ROLE_IN_CASE_VALUES } from '../schemas/borrower.schema';
import type { BorrowerRow, RoleInCase } from '../types';

type SaveResult = { ok: true } | { ok: false; message?: string };

/**
 * Optimistic state + save handlers for one borrower card's inline fields
 * (borrower columns + the case_borrowers role). Wired into
 * useInlineMutationSync so every save schedules a background router.refresh —
 * the borrower actions skip revalidatePath (FE-1), and without the refresh
 * the router cache kept serving the pre-edit payload on back/forward (the
 * "typed it but it's gone" bug, incl. edit-on-stale data loss). Resyncs from
 * props are gated the same way so a stale payload can't revert a field.
 */
export function useBorrowerCardState(caseId: string, borrower: BorrowerRow, roleInCase: RoleInCase) {
  const { pendingCount, refreshOwed, beginOp, endOp, refreshSoon } = useInlineMutationSync();
  const canApplyResync = pendingCount === 0 && !refreshOwed;

  const [localBorrower, setLocalBorrower] = useState(borrower);
  const borrowerSig = JSON.stringify(borrower);
  const [borrowerRef, setBorrowerRef] = useState(borrowerSig);
  if (borrowerSig !== borrowerRef) {
    // Always advance past the payload; apply only while idle (see hook doc).
    setBorrowerRef(borrowerSig);
    if (canApplyResync) setLocalBorrower(borrower);
  }

  const [localRole, setLocalRole] = useState<RoleInCase>(roleInCase);
  const [roleRef, setRoleRef] = useState<RoleInCase>(roleInCase);
  if (roleInCase !== roleRef) {
    setRoleRef(roleInCase);
    if (canApplyResync) setLocalRole(roleInCase);
  }

  const saveField = async (
    field: EditableBorrowerField,
    value: string | null,
  ): Promise<SaveResult> => {
    const prev = localBorrower[field];
    setLocalBorrower((b) => ({ ...b, [field]: value }));
    beginOp();
    try {
      const result = await updateBorrowerFieldAction(borrower.id, caseId, field, value);
      if (!result.ok) {
        setLocalBorrower((b) => ({ ...b, [field]: prev }));
        return { ok: false, message: result.message };
      }
      return { ok: true };
    } catch {
      setLocalBorrower((b) => ({ ...b, [field]: prev }));
      return { ok: false };
    } finally {
      endOp();
      refreshSoon();
    }
  };

  // Role lives on case_borrowers (junction), so it routes through its own
  // action rather than the borrower-table saveField bridge above.
  const saveRole = async (value: string | null): Promise<SaveResult> => {
    const next = ROLE_IN_CASE_VALUES.find((r) => r === value);
    if (!next) return { ok: false };
    const prev = localRole;
    setLocalRole(next);
    beginOp();
    try {
      const result = await updateBorrowerRoleAction(caseId, borrower.id, next);
      if (!result.ok) {
        setLocalRole(prev);
        return { ok: false, message: result.message };
      }
      return { ok: true };
    } catch {
      setLocalRole(prev);
      return { ok: false };
    } finally {
      endOp();
      refreshSoon();
    }
  };

  return { localBorrower, localRole, saveField, saveRole };
}
