'use client';

import { useMemo, useState, useTransition } from 'react';

import { Loader2, Star, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Tooltip } from '@/components/ui/tooltip';
import { EditableField } from '@/features/borrowers/components/editable-field';

import { deleteIncomeAction } from '../actions/delete-income';
import {
  updateIncomeFieldAction,
  type EditableIncomeField,
} from '../actions/update-income-field';
import type { IncomeTypeOption, IncomeWithType } from '../types';

type Props = {
  caseId: string;
  income: IncomeWithType;
  incomeTypes: ReadonlyArray<IncomeTypeOption>;
  locale: 'he' | 'en';
  canEdit: boolean;
};

/**
 * One income, rendered as a small card with every field visible and inline-
 * editable. Reuses the borrowers' EditableField primitive so labels, save
 * indicators, and rollback-on-error all behave consistently across the app.
 * The is_primary toggle is a star button (more obvious than a checkbox) and
 * the delete sits in the card's header on hover.
 */
export function IncomeRow({ caseId, income, incomeTypes, locale, canEdit }: Props) {
  const t = useTranslations('incomes');
  const tf = useTranslations('incomes.fields');
  const tc = useTranslations('common');

  const [row, setRow] = useState(income);
  const [savingPrimary, startPrimary] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  // Resync from server when the parent revalidates.
  const [propRef, setPropRef] = useState(income);
  if (income !== propRef) {
    setPropRef(income);
    setRow(income);
  }

  const fmt = new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });

  const typeOptions = useMemo(
    () =>
      incomeTypes.map((it) => ({
        value: it.id,
        label: locale === 'he' ? it.name_he : it.name_en,
      })),
    [incomeTypes, locale],
  );

  // Single-field save bridge. Optimistic update + rollback on failure;
  // EditableField also rolls back its own input when the prop value reverts.
  const saveField = async (field: EditableIncomeField, value: unknown) => {
    const prev = row[field];
    setRow((r) => ({ ...r, [field]: value as never }));
    const result = await updateIncomeFieldAction(income.id, caseId, field, value);
    if (!result.ok) {
      setRow((r) => ({ ...r, [field]: prev as never }));
      return { ok: false, message: result.message };
    }
    return { ok: true } as const;
  };

  const togglePrimary = () => {
    const next = !row.is_primary;
    setRow((r) => ({ ...r, is_primary: next }));
    startPrimary(async () => {
      const result = await updateIncomeFieldAction(income.id, caseId, 'is_primary', next);
      if (!result.ok) {
        setRow((r) => ({ ...r, is_primary: !next }));
        toast.error(result.message || tc('saveFailed'));
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(t('confirmDelete'))) return;
    startDelete(async () => {
      const result = await deleteIncomeAction(income.id, income.borrower_id, caseId);
      if (result.ok) {
        toast.success(t('deleteSuccess'));
      } else {
        toast.error(t('deleteError'));
      }
    });
  };

  const headerSubtitle =
    row.amount_monthly !== null && row.amount_monthly !== undefined
      ? fmt.format(Number(row.amount_monthly))
      : tf('amountMonthly');

  return (
    <li className="border border-neutral-200 rounded-lg p-3 bg-white space-y-2 group">
      {/* Header — type/amount summary + star toggle + delete */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-neutral-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm text-neutral-900 truncate">
            {row.income_type === null ? t('untyped') : locale === 'he' ? row.income_type.name_he : row.income_type.name_en}
          </span>
          <span aria-hidden="true" className="text-neutral-300">·</span>
          <span className="font-mono text-sm text-neutral-700 shrink-0" dir="ltr">
            {headerSubtitle}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {canEdit && (
            <Tooltip content={tf('isPrimary')}>
              <button
                type="button"
                onClick={togglePrimary}
                aria-pressed={row.is_primary}
                aria-label={tf('isPrimary')}
                disabled={savingPrimary || isDeleting}
                className="size-7 rounded inline-flex items-center justify-center text-neutral-400 hover:text-[#A88840] hover:bg-neutral-50 transition disabled:opacity-50"
              >
                {savingPrimary ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Star
                    className={`size-4 transition ${row.is_primary ? 'fill-[#C9A961] text-[#A88840]' : ''}`}
                    aria-hidden="true"
                  />
                )}
              </button>
            </Tooltip>
          )}
          {canEdit && (
            <Tooltip content={tc('delete')}>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                aria-label={tc('delete')}
                className="size-7 rounded inline-flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-neutral-50 transition opacity-0 group-hover:opacity-100 disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-3.5" aria-hidden="true" />
                )}
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        <EditableField
          type="select"
          label={tf('type')}
          value={row.income_type_id}
          options={typeOptions}
          onSave={(v) => saveField('income_type_id', v)}
        />
        <EditableField
          type="number"
          label={tf('amountMonthly')}
          value={row.amount_monthly === null ? null : String(row.amount_monthly)}
          onSave={(v) => saveField('amount_monthly', v === null ? null : Number(v))}
        />
        <div className="sm:col-span-2">
          <EditableField
            label={tf('sourceName')}
            value={row.source_name}
            onSave={(v) => saveField('source_name', v)}
            placeholder={tf('sourceNamePlaceholder')}
          />
        </div>
        <EditableField
          type="number"
          label={tf('tenureMonths')}
          value={row.tenure_months === null ? null : String(row.tenure_months)}
          onSave={(v) => saveField('tenure_months', v === null ? null : Number(v))}
        />
        <div className="sm:col-span-2">
          <EditableField
            type="textarea"
            rows={2}
            label={tf('notes')}
            value={row.notes}
            onSave={(v) => saveField('notes', v)}
          />
        </div>
      </div>
    </li>
  );
}
