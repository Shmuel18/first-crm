'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { Coins, Eye, EyeOff, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsStringEnum, useQueryState } from 'nuqs';

import { formatCurrency } from '@/lib/utils/format-currency';
import type { Locale } from '@/lib/i18n/direction';

import { collectionBalance, collectionStatus, netProfit, sumCollected } from '../domain/collections-calc';
import type { CollectionOverviewRow, CollectionStatus } from '../types';

type Props = {
  rows: ReadonlyArray<CollectionOverviewRow>;
  /** advisor id → display name, resolved on the server. */
  advisorNames: Record<string, string>;
  locale: Locale;
};

const FILTERS = ['all', 'not_started', 'partial', 'collected', 'overpaid'] as const;
type Filter = (typeof FILTERS)[number];

const MASK = '••••••';

const STATUS_STYLES: Record<CollectionStatus, string> = {
  not_started: 'bg-neutral-100 text-neutral-600',
  partial: 'bg-brand-gold-soft text-brand-gold-text',
  collected: 'bg-emerald-50 text-emerald-700',
  overpaid: 'bg-amber-50 text-amber-700',
};

export function CollectionsOverview({ rows, advisorNames, locale }: Props) {
  const t = useTranslations('collections');
  const [revealed, setRevealed] = useState(false);
  const [filter, setFilter] = useQueryState(
    'status',
    parseAsStringEnum<Filter>([...FILTERS]).withDefault('all'),
  );

  const enriched = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        status: collectionStatus(r.feeAmount, r.collected),
        balance: collectionBalance(r.feeAmount, r.collected),
      })),
    [rows],
  );

  const totals = useMemo(() => {
    const collected = sumCollected(enriched.map((r) => r.collected));
    const expenses = sumCollected(enriched.map((r) => r.expenses));
    const open = enriched.reduce((acc, r) => acc + Math.max(0, r.balance), 0);
    return { collected, expenses, open, profit: netProfit(collected, expenses) };
  }, [enriched]);

  const visible = filter === 'all' ? enriched : enriched.filter((r) => r.status === filter);

  const show = (v: number): string => (revealed ? formatCurrency(v, locale) : MASK);
  const fmtDate = (iso: string | null): string =>
    iso ? new Date(iso).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB') : '—';
  const RevealIcon = revealed ? EyeOff : Eye;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-pressed={revealed}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-neutral-600 transition hover:bg-brand-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
        >
          <RevealIcon className="size-4" aria-hidden="true" />
          <span>{revealed ? t('hide') : t('reveal')}</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label={t('summary.collected')} value={show(totals.collected)} icon={Wallet} accent />
        <SummaryCard label={t('summary.open')} value={show(totals.open)} icon={Coins} />
        <SummaryCard label={t('summary.expenses')} value={show(totals.expenses)} icon={Receipt} />
        <SummaryCard label={t('summary.profit')} value={show(totals.profit)} icon={TrendingUp} />
      </div>

      {/* Status filter */}
      <div role="group" aria-label={t('filter.label')} className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-neutral-100 p-0.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={[
              'rounded-md px-3 py-1.5 text-xs font-medium transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50',
              filter === f ? 'bg-brand-black text-white shadow-sm' : 'text-neutral-700 hover:bg-white/70',
            ].join(' ')}
          >
            {t(`filter.${f}`)}
          </button>
        ))}
      </div>

      {/* Per-case table */}
      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-400">{t('overview.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
                <th className="px-3 py-2 text-start font-medium">{t('overview.case')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('overview.advisor')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('overview.agreedFee')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('overview.collected')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('overview.balance')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('overview.status')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('overview.lastPayment')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.caseId} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60">
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link
                      href={`/cases/${r.caseId}`}
                      className="font-medium text-brand-gold-text hover:underline"
                    >
                      {r.caseNumber}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-600">
                    {(r.assignedAdvisorId && advisorNames[r.assignedAdvisorId]) || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-700 tabular-nums">
                    {r.feeAmount == null ? '—' : show(r.feeAmount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-neutral-900 tabular-nums">
                    {show(r.collected)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-700 tabular-nums">
                    {r.feeAmount == null ? '—' : show(Math.max(0, r.balance))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                      {t(`status.${r.status}`)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-500 tabular-nums">
                    {fmtDate(r.lastPaymentOn)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? 'border-brand-gold/40 bg-brand-gold-soft' : 'border-neutral-200 bg-white'}`}>
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        <Icon className="size-3.5 text-brand-gold-text" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate font-display text-xl font-semibold text-neutral-950 tabular-nums">{value}</div>
    </div>
  );
}
