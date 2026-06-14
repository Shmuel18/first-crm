'use client';

import { useState, useTransition } from 'react';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { addCasePropertyAction } from '../actions/add-case-property';
import { removeCasePropertyAction } from '../actions/remove-case-property';
import { updateCasePropertyFieldAction } from '../actions/update-case-property-field';

import { PropertyFields } from './property-fields';

import type { CaseProperty } from '../services/case-properties.service';

type CaseTypeOption = { id: string; key: string; name_he: string };
type PropertyField = 'city' | 'property_value' | 'requested_mortgage_amount';
type SaveResult = { ok: true } | { ok: false; message?: string };

const BLANK: Omit<CaseProperty, 'id'> = {
  case_type_primary_id: null,
  case_type_other_text: null,
  city: null,
  property_value: null,
  requested_mortgage_amount: null,
};

/**
 * The "additional properties" section under the primary property. Each row is
 * the same four fields (purpose · city · value · loan), editable inline, plus a
 * remove button; an "add property" button appends a blank row. All mutations are
 * optimistic (no revalidatePath) to avoid the heavy /cases/[id] scroll-jump.
 */
export function CaseAdditionalProperties({
  caseId,
  initial,
  caseTypes,
  otherCaseTypeId,
  canEdit = true,
}: {
  caseId: string;
  initial: ReadonlyArray<CaseProperty>;
  caseTypes: ReadonlyArray<CaseTypeOption>;
  otherCaseTypeId: string | null;
  /** When false, render the additional properties read-only (no add/remove). */
  canEdit?: boolean;
}) {
  const t = useTranslations('case.property');
  const [rows, setRows] = useState<CaseProperty[]>([...initial]);
  const [adding, startAdd] = useTransition();

  const onAdd = (): void =>
    startAdd(async () => {
      const res = await addCasePropertyAction(caseId);
      if (!res.ok) {
        toast.error(t('addFailed'));
        return;
      }
      setRows((r) => [...r, { id: res.id, ...BLANK }]);
    });

  const onRemove = async (id: string): Promise<void> => {
    const prev = rows;
    setRows((r) => r.filter((p) => p.id !== id));
    const res = await removeCasePropertyAction(caseId, id);
    if (!res.ok) {
      setRows(prev);
      toast.error(t('removeFailed'));
    }
  };

  const saveField =
    (id: string) =>
    async (field: PropertyField, value: string | null): Promise<SaveResult> => {
      const prev = rows;
      const coerced =
        field === 'city' ? value : value === null || value === '' ? null : Number(value);
      setRows((r) => r.map((p) => (p.id === id ? { ...p, [field]: coerced as never } : p)));
      const res = await updateCasePropertyFieldAction(caseId, id, field, value);
      if (!res.ok) {
        setRows(prev);
        return { ok: false };
      }
      return { ok: true };
    };

  const savePurpose =
    (id: string) =>
    async (primary: string | null, other: string | null): Promise<void> => {
      const prev = rows;
      setRows((r) =>
        r.map((p) =>
          p.id === id
            ? { ...p, case_type_primary_id: primary, case_type_other_text: other }
            : p,
        ),
      );
      const r1 = await updateCasePropertyFieldAction(caseId, id, 'case_type_primary_id', primary);
      const r2 = await updateCasePropertyFieldAction(caseId, id, 'case_type_other_text', other);
      if (!r1.ok || !r2.ok) {
        setRows(prev);
        toast.error(t('saveFailed'));
      }
    };

  return (
    <div className="mt-4 space-y-3">
      {rows.map((p, i) => (
        <div key={p.id} className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">
              {t('additionalLabel', { n: i + 2 })}
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={() => void onRemove(p.id)}
                aria-label={t('remove')}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                {t('remove')}
              </button>
            )}
          </div>
          <PropertyFields
            values={p}
            caseTypes={caseTypes}
            otherCaseTypeId={otherCaseTypeId}
            onSaveField={saveField(p.id)}
            onSavePurpose={savePurpose(p.id)}
            canEdit={canEdit}
          />
        </div>
      ))}

      {canEdit && (
        <button
          type="button"
          onClick={onAdd}
          disabled={adding}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-600 transition hover:border-brand-gold-text hover:text-brand-gold-text disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t('add')}
        </button>
      )}
    </div>
  );
}
