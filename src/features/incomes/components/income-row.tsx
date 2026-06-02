'use client';

import { useMemo, useState, useTransition } from 'react';

import { Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { CurrencySign } from '@/components/ui/currency-sign';
import { Tooltip } from '@/components/ui/tooltip';
import { EditableField } from '@/features/borrowers/components/editable-field';
import { formatCurrency } from '@/lib/utils/format-currency';

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
  /**
   * False hides the trash button — used for the first income in each
   * borrower's group (the "primary employment" slot which the group
   * auto-creates and treats as structural). Defaults true for back-compat
   * with any caller that hasn't been migrated yet.
   */
  canDelete?: boolean;
};

/**
 * One income, rendered as a small card with every field visible and inline-
 * editable. Reuses the borrowers' EditableField primitive so labels, save
 * indicators, and rollback-on-error all behave consistently across the app.
 *
 * The "primary income" star was removed: with the auto-create flow the
 * first row in each borrower's group is implicitly the primary employment
 * and the rest are "other incomes". The is_primary column is still in DB
 * for back-compat / future bulk views — just no longer surfaced here.
 */
export function IncomeRow({ caseId, income, incomeTypes, locale, canEdit, canDelete = true }: Props) {
  const t = useTranslations('incomes');
  const tf = useTranslations('incomes.fields');
  const tc = useTranslations('common');

  const [row, setRow] = useState(income);
  const [isDeleting, startDelete] = useTransition();

  // Resync from server when the parent revalidates.
  const [propRef, setPropRef] = useState(income);
  if (income !== propRef) {
    setPropRef(income);
    setRow(income);
  }

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

  const handleDelete = () => {
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
      ? formatCurrency(Number(row.amount_monthly), locale)
      : tf('amountMonthly');

  return (
    <li className="border border-neutral-200 rounded-lg p-3 bg-white space-y-2 group">
      {/* Header — type/amount summary + delete on hover (no primary star). */}
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
          {canEdit && canDelete && (
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
          adornment={<CurrencySign />}
          groupThousands
        />
        <div className="sm:col-span-2">
          <EditableField
            label={tf('sourceName')}
            value={row.source_name}
            onSave={(v) => saveField('source_name', v)}
            placeholder={tf('sourceNamePlaceholder')}
          />
        </div>
        {/* Date + seniority share one row but split 2fr:1fr — the date
            using equal columns, so the seniority readout aligns with the
            monthly amount field above instead of ending too far left. */}
        <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-x-6 gap-y-1.5">
          <EditableField
            type="date"
            label={tf('employmentStartDate')}
            value={row.employment_start_date}
            onSave={(v) => saveField('employment_start_date', v)}
          />
          <SeniorityReadout
            label={tf('seniority')}
            startDateIso={row.employment_start_date}
            tenureMonthsFallback={row.tenure_months}
          />
        </div>
      </div>
    </li>
  );
}

/**
 * Read-only "ותק" display derived from employment_start_date. Falls back to
 * the legacy tenure_months column if the date isn't set yet. Layout matches
 * EditableField (right-side label + 1fr value) so the row reads as one
 * coherent grid instead of "two different field shapes side by side".
 *
 * Years are shown to 2 decimals — matches the reference design and avoids
 * the "is 18 months one-and-a-half or two?" ambiguity of integer years.
 */
function SeniorityReadout({
  label,
  startDateIso,
  tenureMonthsFallback,
}: {
  label: string;
  startDateIso: string | null;
  tenureMonthsFallback: number | null;
}) {
  const display = computeSeniorityYears(startDateIso, tenureMonthsFallback);
  return (
    <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2 text-sm">
      <span className="text-neutral-500 truncate">{label}</span>
      {/* Flex container mirrors EditableField's value side: readout takes
          flex-1, plus an invisible size-4 spacer where the save indicator
          would be on a regular field. That keeps the readout's LEFT edge
          at the same position as the source-name input's left edge in
          the row above — without the spacer the readout was overshooting
          by ~22px (save-indicator width + gap), drifting past the
          source-name's terminator. */}
      <div className="flex items-center gap-1.5 min-w-0">
        <div
          dir="ltr"
          aria-readonly="true"
          className="h-9 px-3 flex items-center justify-end flex-1 text-sm text-neutral-900 bg-neutral-50/80 border border-neutral-200 rounded-md"
        >
          {display ?? <span className="text-neutral-300">—</span>}
        </div>
        {/* inline-flex forces the span to honour its size-4 dimensions —
            a bare <span> is `display: inline` which ignores width/height,
            so the spacer was rendering at 0px and the readout overshot
            into where the source-name input terminates above. */}
        <span aria-hidden="true" className="inline-flex size-4 shrink-0 invisible" />
      </div>
    </div>
  );
}

function computeSeniorityYears(
  startDateIso: string | null,
  tenureMonthsFallback: number | null,
): string | null {
  if (startDateIso) {
    const start = new Date(startDateIso);
    if (Number.isFinite(start.getTime())) {
      const now = new Date();
      const rawMonths =
        (now.getFullYear() - start.getFullYear()) * 12 +
        (now.getMonth() - start.getMonth());
      // Subtract 1 if we haven't reached the day-of-month yet this month.
      const months = now.getDate() >= start.getDate() ? rawMonths : rawMonths - 1;
      if (months < 0) return null;
      return (months / 12).toFixed(2);
    }
  }
  if (tenureMonthsFallback !== null && tenureMonthsFallback >= 0) {
    return (tenureMonthsFallback / 12).toFixed(2);
  }
  return null;
}
