'use client';

import { useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useInlineMutationSync } from '@/lib/hooks/use-inline-mutation-sync';
import { useSyncedRows } from '@/lib/hooks/use-synced-rows';

import { addCasePropertyAction } from '../actions/add-case-property';
import { removeCasePropertyAction } from '../actions/remove-case-property';
import { updateCasePropertyFieldAction } from '../actions/update-case-property-field';
import type { CaseProperty } from '../services/case-properties.service';

export type PropertyField = 'city' | 'gush_helka' | 'property_value' | 'requested_mortgage_amount';
type SaveResult = { ok: true } | { ok: false; message?: string };

// Text fields pass through as-is; the rest are numeric and get coerced.
const TEXT_PROPERTY_FIELDS: ReadonlyArray<PropertyField> = ['city', 'gush_helka'];

const BLANK: Omit<CaseProperty, 'id'> = {
  case_type_primary_id: null,
  case_type_other_text: null,
  city: null,
  gush_helka: null,
  property_value: null,
  requested_mortgage_amount: null,
};

/**
 * Optimistic state for the additional-properties rows. The property actions
 * skip revalidatePath (FE-1) — useInlineMutationSync's debounced background
 * router.refresh keeps the router cache from restoring the pre-mutation page
 * on back/forward; prop resyncs are gated so a stale payload can't revert.
 */
export function useCaseProperties(caseId: string, initial: ReadonlyArray<CaseProperty>) {
  const t = useTranslations('case.property');
  const [adding, startAdd] = useTransition();
  const { pendingCount, refreshOwed, beginOp, endOp, refreshSoon } = useInlineMutationSync();

  const sig = initial
    .map((p) => `${p.id}:${p.case_type_primary_id ?? ''}:${p.case_type_other_text ?? ''}:${p.city ?? ''}:${p.gush_helka ?? ''}:${p.property_value ?? ''}:${p.requested_mortgage_amount ?? ''}`)
    .join('|');
  const [rows, setRows] = useSyncedRows(sig, () => [...initial], pendingCount === 0 && !refreshOwed);

  // Add waits for the server id (no temp row) — the button shows `adding`.
  const onAdd = (): void => {
    beginOp();
    startAdd(async () => {
      try {
        const res = await addCasePropertyAction(caseId);
        if (!res.ok) {
          toast.error(t('addFailed'));
          refreshSoon();
          return;
        }
        setRows((r) => [...r, { id: res.id, ...BLANK }]);
        refreshSoon();
      } finally {
        endOp();
      }
    });
  };

  const onRemove = async (id: string): Promise<void> => {
    const prev = rows;
    setRows((r) => r.filter((p) => p.id !== id));
    beginOp();
    try {
      const res = await removeCasePropertyAction(caseId, id);
      if (!res.ok) {
        setRows(prev);
        toast.error(t('removeFailed'));
      }
    } catch {
      setRows(prev);
      toast.error(t('removeFailed'));
    } finally {
      endOp();
      refreshSoon();
    }
  };

  const saveField =
    (id: string) =>
    async (field: PropertyField, value: string | null): Promise<SaveResult> => {
      const prev = rows;
      const coerced = TEXT_PROPERTY_FIELDS.includes(field)
        ? value
        : value === null || value === ''
          ? null
          : Number(value);
      setRows((r) => r.map((p) => (p.id === id ? { ...p, [field]: coerced as never } : p)));
      beginOp();
      try {
        const res = await updateCasePropertyFieldAction(caseId, id, field, value);
        if (!res.ok) {
          setRows(prev);
          return { ok: false };
        }
        return { ok: true };
      } catch {
        setRows(prev);
        return { ok: false };
      } finally {
        endOp();
        refreshSoon();
      }
    };

  const savePurpose =
    (id: string) =>
    async (primary: string | null, other: string | null): Promise<void> => {
      const prev = rows;
      setRows((r) =>
        r.map((p) =>
          p.id === id ? { ...p, case_type_primary_id: primary, case_type_other_text: other } : p,
        ),
      );
      beginOp();
      try {
        const r1 = await updateCasePropertyFieldAction(caseId, id, 'case_type_primary_id', primary);
        const r2 = await updateCasePropertyFieldAction(caseId, id, 'case_type_other_text', other);
        if (!r1.ok || !r2.ok) {
          setRows(prev);
          toast.error(t('saveFailed'));
        }
      } catch {
        setRows(prev);
        toast.error(t('saveFailed'));
      } finally {
        endOp();
        refreshSoon();
      }
    };

  return { rows, adding, onAdd, onRemove, saveField, savePurpose };
}
