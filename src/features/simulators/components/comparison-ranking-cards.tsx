'use client';

import { Coins, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { MixComparisonResult } from '../domain/mix-compare';

type Props = { comparison: MixComparisonResult };

export function ComparisonRankingCards({ comparison }: Props) {
  const t = useTranslations('simulators.compare.ranking');
  const cards = [
    { key: 'cheapest', label: comparison.cheapestLabel, Icon: Coins, tone: 'text-emerald-600' },
    { key: 'mostStable', label: comparison.mostStableLabel, Icon: ShieldCheck, tone: 'text-sky-600' },
    { key: 'mostFlexible', label: comparison.mostFlexibleLabel, Icon: Sparkles, tone: 'text-brand-gold-text' },
    { key: 'riskiest', label: comparison.riskiestLabel, Icon: TriangleAlert, tone: 'text-red-600' },
  ] as const;

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ key, label, Icon, tone }) => (
        <div key={key} className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Icon className={`size-5 ${tone}`} aria-hidden="true" />
            <span className="text-sm font-medium text-neutral-600">{t(key)}</span>
          </div>
          <div className="mt-2 font-display text-2xl font-semibold text-neutral-950">{t('variant', { label })}</div>
        </div>
      ))}
    </section>
  );
}
