'use client';

import { Banknote, Coins, Percent, PiggyBank, Ratio, Scale, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { RiskGauge } from './risk-gauge';
import { formatMoney, formatPct, formatRatio } from '../utils/format';

import type { MixExposure } from '../domain/mix-exposure';
import type { MixResult } from '../types';

type Props = { result: MixResult; exposure: MixExposure };

type Kpi = { key: string; label: string; value: string; sub?: string; icon: LucideIcon; hero?: boolean };

/**
 * Full-width dark "dashboard" strip of the headline numbers, with the first
 * monthly payment promoted as the gold hero and a rate-exposure gauge tile.
 * Pure presentation — every value comes pre-computed from the live engine.
 */
export function KpiStrip({ result, exposure }: Props) {
  const t = useTranslations('simulators.mix.results');
  const items: ReadonlyArray<Kpi> = [
    { key: 'firstPayment', label: t('firstPayment'), value: formatMoney(result.firstPayment), icon: Coins, hero: true },
    {
      key: 'maxPayment',
      label: t('maxPayment'),
      value: formatMoney(result.maxPayment),
      sub: result.maxPaymentMonth > 0 ? t('maxPaymentMonth', { month: result.maxPaymentMonth }) : undefined,
      icon: TrendingUp,
    },
    { key: 'totalCost', label: t('totalCost'), value: formatMoney(result.totalCost), icon: PiggyBank },
    { key: 'effectiveRate', label: t('effectiveRate'), value: formatPct(result.effectiveRatePct), icon: Percent },
    { key: 'totalInterest', label: t('totalInterest'), value: formatMoney(result.totalInterest), icon: Banknote },
    { key: 'costPerShekel', label: t('costPerShekel'), value: formatRatio(result.costPerShekel), icon: Ratio },
    { key: 'ltv', label: t('ltv'), value: formatPct(result.ltv), icon: Scale },
  ];

  return (
    <section className="rounded-xl bg-brand-black p-3 shadow-sm sm:p-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {items.map(({ key, label, value, sub, icon: Icon, hero }) => (
          <div key={key} className={`min-w-0 rounded-lg bg-brand-black-soft p-3 ${hero ? 'ring-1 ring-brand-gold/30' : ''}`}>
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
        <div className="flex min-w-0 items-center gap-2.5 rounded-lg bg-brand-black-soft p-3">
          <RiskGauge level={exposure.level} valuePct={exposure.exposurePct} />
          <div className="min-w-0">
            <div className="truncate text-xs text-neutral-400">{t('exposure')}</div>
            <div className="mt-0.5 truncate text-base font-semibold tabular-nums text-white">{formatPct(exposure.exposurePct)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
