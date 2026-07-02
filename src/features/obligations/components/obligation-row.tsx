'use client';

import { useState, useTransition } from 'react';

import { ChevronDown, Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Tooltip } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/utils/format-currency';

import { deleteObligationAction } from '../actions/delete-obligation';
import {
  updateObligationFieldAction,
  type EditableObligationField,
} from '../actions/update-obligation-field';
import { monthsUntil } from '../domain/months-remaining';
import type { ObligationRow as ObligationRowData } from '../types';

type Props = {
  caseId: string;
  obligation: ObligationRowData;
  locale: 'he' | 'en';
  canEdit: boolean;
};

/**
 * One obligation rendered as an inline-editable card — matches the
 * IncomeRow pattern so the case page's debt section reads as the same
 * visual family as incomes. No dialog: every field saves on blur via the
 * shared EditableField primitive.
 */
export function ObligationRow({ caseId, obligation, locale, canEdit }: Props) {
  const t = useTranslations('obligations');
  const tf = useTranslations('obligations.fields');
  const tc = useTranslations('common');

  const [row, setRow] = useState(obligation);
  const [isDeleting, startDelete] = useTransition();
  // Collapsed by default — the obligation header alone is dense enough
  // for a quick scan of the case's debt picture. Expanding reveals the
  // inline-edit field grid. Empty new rows (no lender, no payment) start
  // expanded so the user can fill them without an extra click.
  const [expanded, setExpanded] = useState(
    !obligation.lender && obligation.monthly_payment === null,
  );

  // Resync from server after a sibling save / revalidation.
  const [propRef, setPropRef] = useState(obligation);
  if (obligation !== propRef) {
    setPropRef(obligation);
    setRow(obligation);
  }

  // Optimistic single-field save bridge. EditableField rolls back its own
  // input value on failure via its `value` prop effect.
  const saveField = async (field: EditableObligationField, value: unknown) => {
    const prev = row[field];
    setRow((r) => ({ ...r, [field]: value as never }));
    const result = await updateObligationFieldAction(obligation.id, caseId, field, value);
    if (!result.ok) {
      setRow((r) => ({ ...r, [field]: prev as never }));
      return { ok: false, message: result.message };
    }

    // Smart default: filling end_date also derives months_remaining (the
    // user can still override the months value manually afterward). Same
    // rule as ObligationTableRow — see comment there.
    if (field === 'end_date' && typeof value === 'string' && value) {
      const prevMonths = row.months_remaining;
      const months = monthsUntil(value);
      setRow((r) => ({ ...r, months_remaining: months as never }));
      const monthsResult = await updateObligationFieldAction(
        obligation.id,
        caseId,
        'months_remaining',
        months,
      );
      if (!monthsResult.ok) {
        setRow((r) => ({ ...r, months_remaining: prevMonths as never }));
      }
    }
    return { ok: true } as const;
  };

  const handleDelete = () => {
    startDelete(async () => {
      const result = await deleteObligationAction(obligation.id, obligation.borrower_id, caseId);
      if (result.ok) {
        toast.success(t('deleteSuccess'));
      } else {
        toast.error(t('deleteError'));
      }
    });
  };

  // Header reads "lender · amount · months" when filled, gracefully
  // degrading: a new empty row just says "התחייבות חדשה" instead of
  // showing field-label fallbacks ("החזר חודשי (₪)") that look like
  // the obligation already has those values when it doesn't.
  const hasMonthlyAmount =
    row.monthly_payment !== null && row.monthly_payment !== undefined;
  const headerSubtitle = hasMonthlyAmount
    ? formatCurrency(Number(row.monthly_payment), locale)
    : null;
  const isEmpty = !row.lender && !hasMonthlyAmount && row.months_remaining === null;

  return (
    <li className="border border-neutral-200 rounded-lg bg-white group overflow-hidden">
      {/* Header — clickable to toggle the inline-edit body. Shows lender +
          monthly + months-remaining badge in a single row so most cases
          are scannable without expanding. */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? tc('close') : tc('edit')}
          className="flex-1 flex items-center gap-2 min-w-0 text-start rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
        >
          <ChevronDown
            aria-hidden="true"
            className={[
              'size-3.5 text-neutral-400 transition-transform shrink-0',
              expanded ? 'rotate-180' : '',
            ].join(' ')}
          />
          {isEmpty ? (
            <span className="text-sm text-neutral-500 italic truncate">
              {t('newRowPlaceholder')}
            </span>
          ) : (
            <>
              <span className="font-medium text-sm text-neutral-900 truncate">
                {row.lender || t('unnamedLender')}
              </span>
              {headerSubtitle && (
                <>
                  <span aria-hidden="true" className="text-neutral-300 shrink-0">·</span>
                  <span className="font-mono text-sm text-neutral-700 shrink-0" dir="ltr">
                    {headerSubtitle}
                  </span>
                </>
              )}
              {row.months_remaining !== null && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 shrink-0">
                  {t('monthsLeft', { count: row.months_remaining })}
                </span>
              )}
            </>
          )}
        </button>
        {canEdit && (
          <Tooltip content={tc('delete')}>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              aria-label={tc('delete')}
              className="shrink-0 size-7 rounded inline-flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-neutral-50 transition tap-target opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 disabled:opacity-50"
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

      {expanded && (
        // Single-row layout: 6 stacked-label inputs side by side. flex-wrap
        // keeps things readable when the case page is narrow (mobile / split
        // screen) — fields drop to a new line only when their natural width
        // exceeds the row. Each cell uses InlineStackedField (label on top,
        // input below) so the column doesn't have to budget 6rem for a side
        // label.
        <div className="flex flex-wrap gap-2 px-3 pb-3 pt-1 border-t border-neutral-100">
          <InlineStackedField
            label={tf('lender')}
            value={row.lender}
            placeholder={tf('lenderPlaceholder')}
            onSave={(v) => saveField('lender', v)}
            className="flex-[2] min-w-40"
          />
          <InlineStackedField
            type="number"
            label={tf('monthlyPayment')}
            value={row.monthly_payment === null ? null : String(row.monthly_payment)}
            onSave={(v) => saveField('monthly_payment', v === null ? null : Number(v))}
            className="flex-1 min-w-28"
          />
          <InlineStackedField
            type="number"
            label={tf('loanAmount')}
            value={row.loan_amount === null ? null : String(row.loan_amount)}
            onSave={(v) => saveField('loan_amount', v === null ? null : Number(v))}
            className="flex-1 min-w-28"
          />
          <InlineStackedField
            type="number"
            label={tf('monthsRemaining')}
            value={row.months_remaining === null ? null : String(row.months_remaining)}
            onSave={(v) => saveField('months_remaining', v === null ? null : Number(v))}
            className="flex-1 min-w-24"
          />
          <InlineStackedField
            type="date"
            label={tf('endDate')}
            value={row.end_date}
            onSave={(v) => saveField('end_date', v)}
            className="flex-1 min-w-36"
          />
          <InlineStackedField
            label={tf('description')}
            value={row.description}
            onSave={(v) => saveField('description', v)}
            className="flex-[2] min-w-40"
          />
        </div>
      )}
    </li>
  );
}

/**
 * Single-line inline editor for obligations: small label stacked on top,
 * input below. Skips the EditableField primitive's side-label grid so the
 * cells stay narrow and 6 fields fit on one row. Optimistic update +
 * rollback on save failure (mirrors the EditableField API).
 */
function InlineStackedField({
  label,
  value,
  type = 'text',
  placeholder,
  onSave,
  className,
}: {
  label: string;
  value: string | null;
  type?: 'text' | 'number' | 'date';
  placeholder?: string;
  onSave: (next: string | null) => Promise<{ ok: boolean }>;
  className?: string;
}) {
  const [local, setLocal] = useState(value ?? '');
  const [propRef, setPropRef] = useState(value ?? '');
  if ((value ?? '') !== propRef) {
    setPropRef(value ?? '');
    setLocal(value ?? '');
  }

  const save = (next: string) => {
    const normalized = next.trim();
    if (normalized === (value ?? '').trim()) return;
    void onSave(normalized === '' ? null : normalized).then((res) => {
      if (!res.ok) setLocal(value ?? '');
    });
  };

  const dir =
    type === 'number' || type === 'date' ? 'ltr' : undefined;

  return (
    <label className={['flex flex-col gap-0.5 min-w-0', className ?? ''].join(' ')}>
      <span className="text-xs font-medium text-neutral-500 truncate">{label}</span>
      <input
        type={type}
        value={local}
        dir={dir}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => save(e.target.value)}
        className="h-9 min-w-0 px-2.5 rounded-md border border-neutral-200 bg-white text-sm text-neutral-900 shadow-xs focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 transition [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield] [&::-webkit-calendar-picker-indicator]:hidden"
      />
    </label>
  );
}
