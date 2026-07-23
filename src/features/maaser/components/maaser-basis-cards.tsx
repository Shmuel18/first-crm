'use client';

import { Gift, HandCoins } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { MaaserSummary } from '../domain/calc';

type Props = {
  s: MaaserSummary;
  /** Mask-aware formatter from MaaserView (redacts when hidden). */
  show: (v: number) => string;
};

/**
 * The tithe base laid out as its formula — collected + manual income − case
 * expenses − manual expenses = net — followed by the 10% / 20% obligations.
 */
export function MaaserBasisCards({ s, show }: Props) {
  const t = useTranslations('maaser');

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 font-display text-lg font-semibold text-neutral-950">{t('basis.title')}</h2>
        <dl className="space-y-1.5 text-sm">
          <Line label={t('basis.collected')} value={show(s.feeCollected)} sign="+" />
          <Line label={t('basis.commissions')} value={show(s.commissions)} sign="−" muted />
          <Line label={t('basis.manualIncome')} value={show(s.manualIncome)} sign="+" />
          <Line label={t('basis.manualExpenses')} value={show(s.manualExpenses)} sign="−" muted />
          <div className="!mt-3 flex items-baseline justify-between border-t border-neutral-200 pt-2">
            <dt className="font-semibold text-neutral-900">{t('basis.net')}</dt>
            <dd className="font-display text-xl font-semibold text-neutral-950 tabular-nums">{show(s.netFee)}</dd>
          </div>
        </dl>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:content-start">
        <DueCard label={t('basis.maaserDue')} value={show(s.maaserDue)} icon={HandCoins} />
        <DueCard label={t('basis.chomeshDue')} value={show(s.chomeshDue)} icon={Gift} />
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  sign,
  muted,
}: {
  label: string;
  value: string;
  sign: '+' | '−';
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={`tabular-nums ${muted ? 'text-neutral-500' : 'text-neutral-800'}`}>
        <span aria-hidden="true" className="me-0.5 text-neutral-400">
          {sign}
        </span>
        {value}
      </dd>
    </div>
  );
}

function DueCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-brand-gold/40 bg-brand-gold-soft p-3 lg:min-w-44">
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        <Icon className="size-3.5 text-brand-gold-text" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate font-display text-xl font-semibold text-neutral-950 tabular-nums">{value}</div>
    </div>
  );
}
