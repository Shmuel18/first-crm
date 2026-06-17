'use client';

import { useMemo, useState } from 'react';

import { useTranslations } from 'next-intl';

import { mortgageStateAtMonth } from '../domain/mix-state';
import { formatMoney } from '../utils/format';

import type { MixResult, MoneyAgorot } from '../types';

type Props = { result: MixResult; mortgageAmount: MoneyAgorot };

/**
 * Interactive "where is the loan at month N" scrubber. The month slider feeds a
 * pure engine snapshot; the panel only renders the pre-computed figures. Bare
 * content — its CollapsibleSection wrapper supplies the card + title.
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
    <div>
      <div className="mb-4 flex items-center gap-3">
        <input
          type="range"
          min={1}
          max={total}
          value={Math.min(month, total)}
          onChange={(event) => setMonth(Number(event.target.value))}
          aria-label={t('monthLabel')}
          className="w-full accent-brand-gold-text"
        />
        <span className="shrink-0 rounded-md bg-brand-black px-2.5 py-1 text-sm font-semibold tabular-nums text-brand-gold">
          {t('monthValue', { month: state.month })}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {stats.map(({ key, label, value, accent }) => (
          <div
            key={key}
            className={`min-w-0 rounded-lg border p-3 ${accent ? 'border-brand-gold/30 bg-brand-gold-soft' : 'border-neutral-100 bg-neutral-50'}`}
          >
            <dt className={`text-xs leading-tight ${accent ? 'text-brand-gold-text' : 'text-neutral-500'}`}>{label}</dt>
            <dd className={`mt-1 text-sm font-semibold tabular-nums ${accent ? 'text-brand-gold-text' : 'text-neutral-900'}`}>
              {formatMoney(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
