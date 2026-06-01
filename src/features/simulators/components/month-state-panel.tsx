'use client';

import { useMemo, useState } from 'react';

import { CalendarClock } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { mortgageStateAtMonth } from '../domain/mix-state';
import type { MixResult, MoneyAgorot } from '../types';
import { formatMoney } from '../utils/format';

type Props = { result: MixResult; mortgageAmount: MoneyAgorot };

/**
 * Interactive "where is the loan at month N" scrubber. The month slider feeds a
 * pure engine snapshot; the panel only renders the pre-computed figures.
 */
export function MonthStatePanel({ result, mortgageAmount }: Props) {
  const t = useTranslations('simulators.mix.monthState');
  const total = result.paymentCurve.length;
  const [month, setMonth] = useState(() => Math.min(12, total || 1));
  const state = useMemo(
    () => mortgageStateAtMonth(result, mortgageAmount, month),
    [result, mortgageAmount, month],
  );

  if (total === 0) return null;

  const stats: ReadonlyArray<{ key: string; label: string; value: MoneyAgorot; accent?: boolean }> = [
    { key: 'closingBalance', label: t('closingBalance'), value: state.closingBalance, accent: true },
    { key: 'paidToDate', label: t('paidToDate'), value: state.paidToDate },
    { key: 'principalReduced', label: t('principalReduced'), value: state.principalReduced },
    { key: 'interestPaid', label: t('interestPaid'), value: state.interestAndIndexationPaid },
    { key: 'monthlyPayment', label: t('monthlyPayment'), value: state.monthlyPayment },
    { key: 'remainingToPay', label: t('remainingToPay'), value: state.remainingToPay },
  ];

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-gold-soft text-brand-gold-text ring-1 ring-brand-gold/20">
          <CalendarClock className="size-4" aria-hidden="true" />
        </span>
        <h2 className="font-display text-lg font-semibold text-neutral-950">{t('title')}</h2>
        <span className="ms-auto rounded-md bg-brand-black px-2.5 py-1 text-sm font-semibold tabular-nums text-brand-gold">
          {t('monthValue', { month: state.month })}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={total}
        value={Math.min(month, total)}
        onChange={(event) => setMonth(Number(event.target.value))}
        aria-label={t('monthLabel')}
        className="mb-4 w-full accent-brand-gold-text"
      />
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(({ key, label, value, accent }) => (
          <div
            key={key}
            className={`rounded-lg border p-3 ${accent ? 'border-brand-gold/30 bg-brand-gold-soft' : 'border-neutral-100 bg-neutral-50'}`}
          >
            <dt className="truncate text-xs text-neutral-500">{label}</dt>
            <dd className={`mt-1 truncate text-sm font-semibold tabular-nums ${accent ? 'text-brand-gold-text' : 'text-neutral-900'}`}>
              {formatMoney(value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
