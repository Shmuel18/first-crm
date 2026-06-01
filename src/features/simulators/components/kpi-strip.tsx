'use client';

import { Banknote, Coins, Percent, PiggyBank, Ratio, Scale, TrendingUp, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { MixResult } from '../types';
import { formatMoney, formatPct, formatRatio } from '../utils/format';

type Props = { result: MixResult };

type Kpi = { key: string; label: string; value: string; sub?: string; icon: LucideIcon; hero?: boolean };

/**
 * Full-width dark "dashboard" strip of the headline numbers, with the first
 * monthly payment promoted as the gold hero. Pure presentation — every value
 * comes pre-computed from the live engine.
 */
export function KpiStrip({ result }: Props) {
  const t = useTranslations('simulators.mix.results');
  const items: ReadonlyArray<Kpi> = [
    { key: 'firstPayment', label: t('firstPayment'), value: formatMoney(result.firstPayment), icon: Coins, hero: true },
    { key: 'averagePayment', label: t('averagePayment'), value: formatMoney(result.averagePayment), icon: Wallet },
    {
      key: 'maxPayment',
      label: t('maxPayment'),
      value: formatMoney(result.maxPayment),
      sub: result.maxPaymentMonth > 0 ? t('maxPaymentMonth', { month: result.maxPaymentMonth }) : undefined,
      icon: TrendingUp,
    },
    { key: 'weightedRate', label: t('weightedRate'), value: formatPct(result.weightedRatePct), icon: Percent },
    { key: 'totalInterest', label: t('totalInterest'), value: formatMoney(result.totalInterest), icon: Banknote },
    { key: 'totalCost', label: t('totalCost'), value: formatMoney(result.totalCost), icon: PiggyBank },
    { key: 'costPerShekel', label: t('costPerShekel'), value: formatRatio(result.costPerShekel), icon: Ratio },
    { key: 'ltv', label: t('ltv'), value: formatPct(result.ltv), icon: Scale },
  ];

  return (
    <section className="rounded-xl bg-brand-black p-3 shadow-sm sm:p-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-4">
        {items.map(({ key, label, value, sub, icon: Icon, hero }) => (
          <div key={key} className={`rounded-lg bg-brand-black-soft p-3 ${hero ? 'ring-1 ring-brand-gold/30' : ''}`}>
            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Icon className={`size-3.5 ${hero ? 'text-brand-gold' : 'text-brand-gold-light'}`} aria-hidden="true" />
              <span className="truncate">{label}</span>
            </div>
            <div className={`mt-1 truncate font-semibold tabular-nums ${hero ? 'font-display text-2xl text-brand-gold' : 'text-base text-white'}`}>
              {value}
            </div>
            {sub && <div className="mt-0.5 truncate text-[11px] text-neutral-400">{sub}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
