'use client';

import { useState } from 'react';

import { ChevronDown, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatCurrency } from '@/lib/utils/format-currency';
import type { Locale } from '@/lib/i18n/direction';

import type { CollectionStatus, FeePayment } from '../types';
import { FeePaymentForm } from './fee-payment-form';
import { FeePaymentsTable } from './fee-payments-table';

type Props = {
  caseId: string;
  payments: FeePayment[];
  feeAmount: number | null;
  collected: number;
  balance: number;
  pct: number;
  status: CollectionStatus;
  canManage: boolean;
  defaultDate: string;
  locale: Locale;
};

/**
 * Compact collections view folded INTO the admin (מנהלה) block — one summary
 * line (collected / balance + a thin progress bar) that expands to the full
 * add-form + ledger on click. Collapsed by default so it never dominates the
 * block; the full management surface also lives on the central /collections.
 */
export function CollectionsCompact({
  caseId,
  payments,
  feeAmount,
  collected,
  balance,
  pct,
  status,
  canManage,
  defaultDate,
  locale,
}: Props) {
  const t = useTranslations('collections');
  const [open, setOpen] = useState(false);
  const met = status === 'collected' || status === 'overpaid';

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
              {feeAmount != null && (
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
                <span className="text-xs text-neutral-400">({t('block.paymentsCount', { count: payments.length })})</span>
              )}
            </div>
            {feeAmount != null && (
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

      {open && (
        <div className="space-y-3 border-t border-neutral-100 p-3">
          {canManage && <FeePaymentForm caseId={caseId} defaultDate={defaultDate} />}
          <FeePaymentsTable caseId={caseId} payments={payments} locale={locale} canManage={canManage} />
        </div>
      )}
    </div>
  );
}
