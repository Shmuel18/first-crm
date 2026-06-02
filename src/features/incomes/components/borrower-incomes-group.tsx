'use client';

import { useEffect, useRef, useTransition } from 'react';

import { Loader2, Plus, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { formatCurrency } from '@/lib/utils/format-currency';

import { createEmptyIncomeAction } from '../actions/create-empty-income';
import { IncomeRow } from './income-row';
import type { IncomeTypeOption, IncomeWithType } from '../types';

type Props = {
  caseId: string;
  borrowerId: string;
  borrowerName: string;
  incomes: ReadonlyArray<IncomeWithType>;
  monthlyTotal: number;
  incomeTypes: ReadonlyArray<IncomeTypeOption>;
  locale: 'he' | 'en';
  canEdit: boolean;
};

/**
 * Per-borrower income list. Each existing income renders as a small card with
 * every field inline-editable (no dialog). "+ Add income" creates an empty
 * row server-side and revalidates — the new card appears in the list and the
 * advisor fills its cells in place.
 */
export function BorrowerIncomesGroup({
  caseId,
  borrowerId,
  borrowerName,
  incomes,
  monthlyTotal,
  incomeTypes,
  locale,
  canEdit,
}: Props) {
  const t = useTranslations('incomes');
  const tc = useTranslations('common');
  const [isAdding, startAdd] = useTransition();

  const handleAdd = () => {
    startAdd(async () => {
      const result = await createEmptyIncomeAction(caseId, borrowerId);
      if (!result.ok) {
        toast.error(result.message || tc('saveFailed'));
      }
    });
  };

  // Eager init: every borrower should always show at least one income card —
  // the "primary employment" slot is structural, not optional. When the
  // server renders the group with zero rows we fire createEmptyIncomeAction
  // once (autoCreatedRef guards against StrictMode double-fire / re-renders
  // between the action firing and revalidation propagating). After the row
  // exists the branch flips off and the effect no-ops on subsequent renders.
  const autoCreatedRef = useRef(false);
  useEffect(() => {
    if (!canEdit) return;
    if (incomes.length > 0) return;
    if (autoCreatedRef.current) return;
    autoCreatedRef.current = true;
    startAdd(async () => {
      const result = await createEmptyIncomeAction(caseId, borrowerId);
      if (!result.ok) {
        // If the eager init fails (RLS, transient DB), unlock the ref so
        // the next render can retry rather than leaving the borrower
        // permanently stuck on the empty state.
        autoCreatedRef.current = false;
        toast.error(result.message || tc('saveFailed'));
      }
    });
  }, [canEdit, incomes.length, caseId, borrowerId, startAdd, tc]);

  return (
    <div className="border border-neutral-200 rounded-lg p-4 bg-white space-y-3">
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-9 rounded-full bg-brand-gold-soft flex items-center justify-center shrink-0">
            <Wallet aria-hidden="true" className="size-5 text-brand-gold-text" />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-neutral-900 text-sm truncate">{borrowerName}</span>
            <span className="text-xs text-neutral-500">
              {t('monthlyTotal')}:{' '}
              <span className="font-semibold text-neutral-800">{formatCurrency(monthlyTotal, locale)}</span>
            </span>
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={isAdding}
            className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-gold-text bg-brand-gold-soft border border-brand-gold/40 rounded-full px-2.5 py-1 hover:bg-brand-gold/20 hover:border-brand-gold/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-3.5" aria-hidden="true" />
            )}
            {t('addIncome')}
          </button>
        )}
      </div>

      {incomes.length === 0 ? (
        // Brief skeleton while the eager-init action lands. Without it the
        // group would render a totally blank body for one tick after first
        // load, which reads as "broken" rather than "loading".
        canEdit ? (
          <div className="h-24 rounded-md bg-neutral-50 animate-pulse" aria-hidden="true" />
        ) : (
          <p className="text-xs text-neutral-500 italic text-center py-3">{t('empty')}</p>
        )
      ) : (
        <ul className="space-y-2">
          {incomes.map((inc, index) => (
            <IncomeRow
              key={inc.id}
              caseId={caseId}
              income={inc}
              incomeTypes={incomeTypes}
              locale={locale}
              canEdit={canEdit}
              // First income is the borrower's primary employment slot — it
              // must always exist (mirrored by the eager init above), so
              // the row hides its delete button. Additional incomes are
              // user-managed and keep their trash.
              canDelete={index > 0}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
