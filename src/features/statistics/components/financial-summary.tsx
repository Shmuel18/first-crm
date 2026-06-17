'use client';

import { useState } from 'react';

import { Banknote, Coins, Eye, EyeOff, Gift, HandCoins, TrendingUp, Wallet } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { parseLocale } from '@/lib/i18n/direction';
import { formatCurrency } from '@/lib/utils/format-currency';
import { KpiCard } from './kpi-card';

import type { StatisticsSummary } from '../schemas/statistics.schema';

type Props = { financial: StatisticsSummary['financial'] };

// Visual redaction only — the figures are still in the page payload (the
// manager is authorized to see them). This guards against shoulder-surfing /
// screen-sharing, not access. Hidden by default so the numbers aren't on
// screen the moment the page loads.
const MASK = '••••••';

export function FinancialSummary({ financial }: Props) {
  const t = useTranslations('statistics');
  const locale = parseLocale(useLocale());
  const [revealed, setRevealed] = useState(false);

  const show = (value: number): string => (revealed ? formatCurrency(value, locale) : MASK);
  const Icon = revealed ? EyeOff : Eye;
  const toggleLabel = revealed ? t('financial.hide') : t('financial.reveal');

  // NET = gross fee − commissions/salaries paid out (case_payouts, migration
  // 186). מעשר / חומש (tithe / fifth) are 10% / 20% of the net — charity
  // figures the manager wants at a glance.
  const netFee = financial.executed_fee_total - financial.executed_payout_total;
  const tithe = netFee * 0.1;
  const fifth = netFee * 0.2;

  return (
    <section className="rounded-xl border border-neutral-200 bg-brand-gold-soft p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-neutral-950">
          {t('financial.title')}
        </h2>
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-pressed={revealed}
          aria-label={toggleLabel}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-neutral-600 transition hover:bg-brand-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
        >
          <Icon className="size-4" aria-hidden="true" />
          <span>{toggleLabel}</span>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard
          label={t('financial.activeLoanVolume')}
          value={show(financial.active_loan_volume)}
          icon={Banknote}
        />
        <KpiCard
          label={t('financial.feeGross')}
          value={show(financial.executed_fee_total)}
          icon={Coins}
        />
        <KpiCard label={t('financial.feeNet')} value={show(netFee)} icon={Wallet} />
        <KpiCard label={t('financial.tithe')} value={show(tithe)} icon={HandCoins} />
        <KpiCard label={t('financial.fifth')} value={show(fifth)} icon={Gift} />
        <KpiCard
          label={t('financial.expectedIncome')}
          value={show(financial.executed_expected_income_total)}
          icon={TrendingUp}
        />
      </div>
    </section>
  );
}
