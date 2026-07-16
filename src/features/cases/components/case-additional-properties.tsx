'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useCaseProperties } from '../hooks/use-case-properties';
import { PropertyFields } from './property-fields';

import type { CaseProperty } from '../services/case-properties.service';

type CaseTypeOption = { id: string; key: string; name_he: string };

/**
 * The "additional properties" section under the primary property. Each row is
 * the same four fields (purpose · city · value · loan), editable inline, plus a
 * remove button; an "add property" button appends a blank row. State lives in
 * useCaseProperties: optimistic mutations (no revalidatePath — avoids the heavy
 * /cases/[id] scroll-jump) + the debounced background router.refresh that keeps
 * the router cache from restoring the pre-mutation page.
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
  const { rows, adding, onAdd, onRemove, saveField, savePurpose } = useCaseProperties(
    caseId,
    initial,
  );

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
