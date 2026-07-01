'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import { Coins, Eye, EyeOff, Plus, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsStringEnum, useQueryState } from 'nuqs';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils/format-currency';
import type { Locale } from '@/lib/i18n/direction';

import { netProfit, sumCollected } from '../domain/collections-calc';
import type { CollectionOverviewRow, CollectionStatus } from '../types';
import { FeePaymentForm } from './fee-payment-form';

type Props = {
  rows: ReadonlyArray<CollectionOverviewRow>;
  /** manage_collections — gates the inline "record payment" action. */
  canManage: boolean;
  /** Today (Israel TZ), server-computed, for the inline payment form. */
  defaultDate: string;
  locale: Locale;
};

// 'open' (an outstanding balance — the cases still to collect from) leads and is
// the default view, so the dashboard always foregrounds what's left to collect.
const FILTERS = ['open', 'all', 'not_started', 'partial', 'collected', 'overpaid'] as const;
type Filter = (typeof FILTERS)[number];

const MASK = '••••••';

const STATUS_STYLES: Record<CollectionStatus, string> = {
  not_started: 'bg-neutral-100 text-neutral-600',
  partial: 'bg-brand-gold-soft text-brand-gold-text',
  collected: 'bg-emerald-50 text-emerald-700',
  overpaid: 'bg-amber-50 text-amber-700',
};

export function CollectionsOverview({ rows, canManage, defaultDate, locale }: Props) {
  const t = useTranslations('collections');
  const [revealed, setRevealed] = useState(false);
  const [payCase, setPayCase] = useState<{ caseId: string; name: string } | null>(null);
  const [filter, setFilter] = useQueryState(
    'status',
    parseAsStringEnum<Filter>([...FILTERS]).withDefault('open'),
  );

  const enriched = useMemo(
    () =>
      rows.map((r) => {
        // Payments cover what's currently due: expenses + advance first, fee only
        // at execution. This order matches real practice: expense reimbursements
        // and advances are collected before the case closes; the advisory fee comes
        // at/after execution.
        const expenseBalance = Math.max(0, r.expenses - r.collected);
        const feeBalance = r.caseStatus === 'execution'
          ? Math.max(0, (r.feeAmount ?? 0) - Math.max(0, r.collected - r.expenses))
          : 0;
        const advance = r.advanceAmount ?? 0;

        // Status reflects whether everything *currently due* has been collected —
        // not whether the full lifetime fee has been paid. A case whose expenses
        // are fully covered is "collected" even if the advisory fee kicks in later.
        const outstanding = feeBalance + expenseBalance + advance;
        const totalAgreed = (r.feeAmount ?? 0) + r.expenses + (r.advanceAmount ?? 0);
        const status: CollectionStatus =
          r.collected <= 0 ? 'not_started'
          : totalAgreed > 0 && r.collected > totalAgreed ? 'overpaid'
          : outstanding <= 0 ? 'collected'
          : 'partial';

        return { ...r, expenseBalance, feeBalance, advance, status };
      }),
    [rows],
  );

  const totals = useMemo(() => {
    const collected = sumCollected(enriched.map((r) => r.collected));
    const expenses = sumCollected(enriched.map((r) => r.expenses));
    const open = enriched.reduce(
      (acc, r) => acc + r.feeBalance + r.expenseBalance + r.advance,
      0,
    );
    return { collected, expenses, open, profit: netProfit(collected, expenses) };
  }, [enriched]);

  const visible = (
    filter === 'all'
      ? enriched
      : filter === 'open'
        ? enriched.filter((r) => r.feeBalance > 0 || r.expenseBalance > 0 || r.advance > 0)
        : enriched.filter((r) => r.status === filter)
  )
    .slice()
    // Most outstanding overall first — highest collector priority at the top.
    .sort(
      (a, b) =>
        (b.feeBalance + b.expenseBalance + b.advance) -
        (a.feeBalance + a.expenseBalance + a.advance),
    );

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
                <th className="px-3 py-2 text-start font-medium">{t('overview.client')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('overview.feeBalance')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('overview.expenses')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('overview.advance')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('overview.collected')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('overview.status')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('overview.lastPayment')}</th>
                {canManage && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.caseId} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60">
                  <td className="px-3 py-2">
                    <Link
                      href={`/cases/${r.caseId}`}
                      className="font-medium text-brand-gold-text hover:underline"
                    >
                      {r.borrowers || r.caseNumber}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {r.feeBalance > 0
                      ? <span className="font-semibold text-red-600">{show(r.feeBalance)}</span>
                      : <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {r.expenseBalance > 0
                      ? <span className="font-semibold text-amber-700">{show(r.expenseBalance)}</span>
                      : <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {r.advance > 0
                      ? <span className="font-semibold text-brand-gold-text">{show(r.advance)}</span>
                      : <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-600 tabular-nums">
                    {r.collected > 0 ? show(r.collected) : <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                      {t(`status.${r.status}`)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-500 tabular-nums">
                    {fmtDate(r.lastPaymentOn)}
                  </td>
                  {canManage && (
                    <td className="whitespace-nowrap px-3 py-2 text-end">
                      <button
                        type="button"
                        onClick={() =>
                          setPayCase({
                            caseId: r.caseId,
                            // Lead with the primary borrower (borrowers is ordered
                            // is_primary first); fall back to the case number.
                            name: r.borrowers ? (r.borrowers.split(', ')[0] ?? r.borrowers) : r.caseNumber,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-brand-gold/50 px-2 py-1 text-xs font-medium text-brand-gold-text transition hover:bg-brand-gold-soft"
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                        {t('block.add')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={payCase !== null} onOpenChange={(open) => !open && setPayCase(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {payCase ? t('overview.addTitle', { name: payCase.name }) : ''}
            </DialogTitle>
          </DialogHeader>
          {payCase && (
            <FeePaymentForm
              caseId={payCase.caseId}
              defaultDate={defaultDate}
              onAdded={() => setPayCase(null)}
            />
          )}
        </DialogContent>
      </Dialog>
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
