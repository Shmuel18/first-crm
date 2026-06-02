import { Banknote, Coins, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { KpiCard } from './kpi-card';
import { formatNis } from '../utils/format';

import type { StatisticsSummary } from '../schemas/statistics.schema';

type Props = { financial: StatisticsSummary['financial'] };

export function FinancialSummary({ financial }: Props) {
  const t = useTranslations('statistics');

  return (
    <section className="rounded-xl border border-neutral-200 bg-brand-gold-soft p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-neutral-950">
          {t('financial.title')}
        </h2>
        <span className="rounded-full bg-brand-black/5 px-2 py-0.5 text-xs text-neutral-500">
          {t('financial.managerOnly')}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label={t('financial.activeLoanVolume')}
          value={formatNis(financial.active_loan_volume)}
          icon={Banknote}
        />
        <KpiCard
          label={t('financial.executedFees')}
          value={formatNis(financial.executed_fee_total)}
          icon={Coins}
        />
        <KpiCard
          label={t('financial.expectedIncome')}
          value={formatNis(financial.executed_expected_income_total)}
          icon={TrendingUp}
        />
      </div>
    </section>
  );
}
