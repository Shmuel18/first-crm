'use client';

import { useState } from 'react';

import { ChevronDown, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatCurrency } from '@/lib/utils/format-currency';
import type { Locale } from '@/lib/i18n/direction';

import { caseCollectionSummary, sumCollected } from '../domain/collections-calc';
import { useFeePayments } from '../hooks/use-fee-payments';
import type { FeePayment } from '../types';
import { FeePaymentForm } from './fee-payment-form';
import { FeePaymentsTable } from './fee-payments-table';

type Props = {
  caseId: string;
  payments: FeePayment[];
  feeAmount: number | null;
  advanceAmount: number | null;
  /** Total office expenses on the case — folded into the balance to collect. */
  expenses: number;
  /** True once the case is in execution — the advisory fee becomes collectible. */
  isExecution: boolean;
  canManage: boolean;
  defaultDate: string;
  locale: Locale;
};

/**
 * Compact collections view folded INTO the admin (מנהלה) block — one summary
 * line (collected / balance + a thin progress bar) that expands to the full
 * add-form + ledger on click. Collapsed by default so it never dominates the
 * block; the full management surface also lives on the central /collections.
 *
 * State lives in useFeePayments: optimistic add/delete + advance draft — the
 * server actions deliberately do NOT revalidate /cases/[id] (that re-renders
 * the heavy case page and scroll-jumps to the top); the hook's debounced
 * background router.refresh keeps the router cache from restoring the
 * pre-mutation page instead.
 */
export function CollectionsCompact({
  caseId,
  payments: initialPayments,
  feeAmount,
  advanceAmount: initialAdvanceAmount,
  expenses,
  isExecution,
  canManage,
  defaultDate,
  locale,
}: Props) {
  const t = useTranslations('collections');
  const [open, setOpen] = useState(false);
  const {
    payments,
    deletingId,
    addPayment,
    deletePayment,
    advanceDraft,
    setAdvanceDraft,
    saveAdvanceDraft,
    onFormMutateStart,
    onFormMutateSettled,
  } = useFeePayments(caseId, initialPayments, initialAdvanceAmount);

  const collected = sumCollected(payments.map((p) => p.amount));
  // The advance is read live from the editable draft. It's the upfront PORTION
  // OF the fee, so pre-execution it IS the fee-due — never added on top. The
  // balance/progress derivation lives in caseCollectionSummary.
  const advance = Number(advanceDraft) || 0;
  const { balance, hasOwed, totalAgreed, pct, met } = caseCollectionSummary(
    feeAmount,
    advance,
    expenses,
    collected,
    isExecution,
  );

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-start"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
              <span className="text-neutral-500">{t('block.collected')}:</span>
              <span className="font-semibold text-neutral-900 tabular-nums">
                {formatCurrency(collected, locale)}
              </span>
              {totalAgreed > 0 && (
                <span className="text-neutral-400 tabular-nums">
                  {t('block.outOf')} {formatCurrency(totalAgreed, locale)}
                </span>
              )}
              {hasOwed && (
                <>
                  <span className="text-neutral-300" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-neutral-500">{t('block.balance')}:</span>
                  <span
                    className={`font-semibold tabular-nums ${met ? 'text-emerald-600' : 'text-brand-gold-text'}`}
                  >
                    {formatCurrency(Math.max(0, balance), locale)}
                  </span>
                </>
              )}
              {payments.length > 0 && (
                <span className="text-xs text-neutral-400">
                  ({t('block.paymentsCount', { count: payments.length })})
                </span>
              )}
            </div>
            {/* What the total is made of. Payments cover expenses first, so
                seeing the two parts is what tells you whether any of the FEE
                has actually come in yet. */}
            {hasOwed && totalAgreed > 0 && (
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 text-xs text-neutral-400">
                {feeAmount != null && feeAmount > 0 && (
                  <span>
                    {t('block.agreedFee')}:{' '}
                    <span className="tabular-nums">{formatCurrency(feeAmount, locale)}</span>
                  </span>
                )}
                {expenses > 0 && (
                  <span>
                    {t('block.expenses')}:{' '}
                    <span className="tabular-nums">{formatCurrency(expenses, locale)}</span>
                  </span>
                )}
              </div>
            )}
            {hasOwed && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full ${met ? 'bg-emerald-500' : 'bg-brand-gold'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
          <ChevronDown
            className={`size-4 shrink-0 text-neutral-400 transition ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {canManage && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-brand-gold/50 px-2 py-1 text-xs font-medium text-brand-gold-text transition hover:bg-brand-gold-soft"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t('block.add')}
          </button>
        )}
      </div>

      {/* Advance amount — visible collapsed too so it's easy to set */}
      <div className="flex items-center gap-2 border-t border-neutral-100 px-3 py-2">
        <label
          htmlFor={`advance-amount-${caseId}`}
          className="shrink-0 text-xs text-neutral-500 select-none"
        >
          {t('block.advanceAmount')}
        </label>
        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-400">₪</span>
          <input
            id={`advance-amount-${caseId}`}
            type="number"
            min="0"
            step="100"
            value={advanceDraft}
            onChange={(e) => canManage && setAdvanceDraft(e.target.value)}
            onBlur={saveAdvanceDraft}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            disabled={!canManage}
            placeholder="—"
            className="w-24 rounded border border-neutral-200 px-1.5 py-0.5 text-xs tabular-nums text-neutral-900 focus:border-brand-gold-text focus:outline-none focus:ring-1 focus:ring-brand-gold-text/30 disabled:opacity-50"
          />
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-neutral-100 p-3">
          {canManage && (
            <FeePaymentForm
              caseId={caseId}
              defaultDate={defaultDate}
              onAdded={addPayment}
              onMutateStart={onFormMutateStart}
              onMutateSettled={onFormMutateSettled}
            />
          )}
          <FeePaymentsTable
            payments={payments}
            locale={locale}
            canManage={canManage}
            onDelete={deletePayment}
            deletingId={deletingId}
          />
        </div>
      )}
    </div>
  );
}
