'use client';

import { TrendingUp, WalletCards } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { MixResult } from '../types';
import { formatMoney, formatPct } from '../utils/format';

type Props = { result: MixResult };

export function ResultsSummary({ result }: Props) {
  const t = useTranslations('simulators.mix.results');
  const cards = [
    { label: t('firstPayment'), value: formatMoney(result.firstPayment) },
    { label: t('averagePayment'), value: formatMoney(result.averagePayment) },
    { label: t('maxPayment'), value: formatMoney(result.maxPayment) },
    { label: t('totalCost'), value: formatMoney(result.totalCost) },
    { label: t('totalInterest'), value: formatMoney(result.totalInterest) },
    { label: t('ltv'), value: formatPct(result.ltv) },
  ];

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-lg bg-brand-gold-soft p-2 text-brand-gold-text">
          <WalletCards className="size-5" aria-hidden="true" />
        </span>
        <h2 className="font-display text-lg font-semibold text-neutral-950">{t('title')}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
            <div className="text-xs text-neutral-500">{card.label}</div>
            <div className="mt-1 text-lg font-semibold text-neutral-950">{card.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-brand-gold-soft px-3 py-2 text-sm text-brand-gold-text">
        <TrendingUp className="size-4" aria-hidden="true" />
        <span>{t('snapshotNote')}</span>
      </div>
    </section>
  );
}
