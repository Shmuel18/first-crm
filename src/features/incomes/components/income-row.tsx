'use client';

import { useMemo } from 'react';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CurrencySign } from '@/components/ui/currency-sign';
import { Tooltip } from '@/components/ui/tooltip';
import { EditableField } from '@/features/borrowers/components/editable-field';
import { formatCurrency } from '@/lib/utils/format-currency';

import { type EditableIncomeField } from '../actions/update-income-field';
import type { IncomeSaveResult, IncomeTypeOption, IncomeWithType } from '../types';

type Props = {
  income: IncomeWithType;
  incomeTypes: ReadonlyArray<IncomeTypeOption>;
  locale: 'he' | 'en';
  canEdit: boolean;
  /**
   * False hides the trash button — used for the first income in each borrower's
   * group (the "primary employment" slot the parent auto-creates and treats as
   * structural). Defaults true for back-compat.
   */
  canDelete?: boolean;
  /** Persist one field. The parent (CaseIncomesClient) owns the optimistic
   *  state + rollback; EditableField reads the returned result to show its own
   *  save/rollback indicator. */
  onSaveField: (field: EditableIncomeField, value: unknown) => Promise<IncomeSaveResult>;
  /** Remove the row. The parent deletes optimistically (the row vanishes
   *  immediately), so there is no per-row spinner. */
  onDelete: () => void;
};

/**
 * One income, rendered as a small card with every field visible and inline-
 * editable. Reuses the borrowers' EditableField primitive so labels, save
 * indicators, and rollback-on-error all behave consistently across the app.
 *
 * The "primary income" star was removed: with the auto-create flow the first
 * row in each borrower's group is implicitly the primary employment and the
 * rest are "other incomes". The is_primary column stays in DB for back-compat.
 */
export function IncomeRow({
  income,
  incomeTypes,
  locale,
  canEdit,
  canDelete = true,
  onSaveField,
  onDelete,
}: Props) {
  const t = useTranslations('incomes');
  const tf = useTranslations('incomes.fields');
  const tc = useTranslations('common');

  const typeOptions = useMemo(
    () =>
      incomeTypes.map((it) => ({
        value: it.id,
        label: locale === 'he' ? it.name_he : it.name_en,
      })),
    [incomeTypes, locale],
  );

  const headerSubtitle =
    income.amount_monthly !== null && income.amount_monthly !== undefined
      ? formatCurrency(Number(income.amount_monthly), locale)
      : tf('amountMonthly');

  return (
    <li className="border border-neutral-200 rounded-lg p-3 bg-white space-y-2 group">
      {/* Header — type/amount summary + delete on hover (no primary star). */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-neutral-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm text-neutral-900 truncate">
            {income.income_type === null
              ? t('untyped')
              : locale === 'he'
                ? income.income_type.name_he
                : income.income_type.name_en}
          </span>
          <span aria-hidden="true" className="text-neutral-300">
            ·
          </span>
          <span className="font-mono text-sm text-neutral-700 shrink-0" dir="ltr">
            {headerSubtitle}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {canEdit && canDelete && (
            <Tooltip content={tc('delete')}>
              <button
                type="button"
                onClick={onDelete}
                aria-label={tc('delete')}
                className="size-7 rounded inline-flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-neutral-50 transition tap-target opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
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
          value={income.income_type_id}
          options={typeOptions}
          onSave={(v) => onSaveField('income_type_id', v)}
        />
        <EditableField
          type="number"
          label={tf('amountMonthly')}
          value={income.amount_monthly === null ? null : String(income.amount_monthly)}
          onSave={(v) => onSaveField('amount_monthly', v === null ? null : Number(v))}
          adornment={<CurrencySign />}
          groupThousands
        />
        <div className="sm:col-span-2">
          <EditableField
            label={tf('sourceName')}
            value={income.source_name}
            onSave={(v) => onSaveField('source_name', v)}
            placeholder={tf('sourceNamePlaceholder')}
          />
        </div>
        {/* Date + seniority share one row but split 2fr:1fr so the seniority
            readout aligns with the monthly amount field above. */}
        <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-x-6 gap-y-1.5">
          <EditableField
            type="date"
            label={tf('employmentStartDate')}
            value={income.employment_start_date}
            onSave={(v) => onSaveField('employment_start_date', v)}
          />
          <SeniorityReadout
            label={tf('seniority')}
            startDateIso={income.employment_start_date}
            tenureMonthsFallback={income.tenure_months}
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
 * coherent grid. Years shown to 2 decimals to avoid integer-year ambiguity.
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
      <div className="flex items-center gap-1.5 min-w-0">
        <div
          dir="ltr"
          aria-readonly="true"
          className="h-9 px-3 flex items-center justify-end flex-1 text-sm text-neutral-900 bg-neutral-50/80 border border-neutral-200 rounded-md"
        >
          {display ?? <span className="text-neutral-300">—</span>}
        </div>
        {/* Invisible spacer mirrors EditableField's save-indicator slot so the
            readout's edge lines up with the source-name input above. */}
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
        (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
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
