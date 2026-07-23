'use client';

import { useMemo } from 'react';

import { Banknote, Coins, Receipt, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { collectionTotals } from '../domain/collections-overview-calc';
import type { EnrichedCollectionRow } from '../domain/collections-overview-calc';

type Props = {
  rows: ReadonlyArray<EnrichedCollectionRow>;
  /** Formats money, or masks it while the screen is hidden. */
  show: (v: number) => string;
};

/**
 * The dashboard headline. The open balance leads, then its two components
 * broken out separately — fee alone and expenses alone. See collectionTotals
 * for why each card's hint carries the GROSS counterpart.
 */
export function CollectionsSummaryCards({ rows, show }: Props) {
  const t = useTranslations('collections');
  const totals = useMemo(() => collectionTotals(rows), [rows]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard label={t('summary.collected')} value={show(totals.collected)} icon={Wallet} accent />
      <SummaryCard label={t('summary.open')} value={show(totals.open)} icon={Coins} />
      <SummaryCard
        label={t('summary.feeOpen')}
        value={show(totals.feeOpen)}
        icon={Banknote}
        // Nothing collectible yet → a "0 of 0" hint is noise, not context.
        hint={
          totals.feeGross > 0
            ? t('summary.feeHint', { total: show(totals.feeGross) })
            : undefined
        }
      />
      <SummaryCard
        label={t('summary.expensesOpen')}
        value={show(totals.expensesOpen)}
        icon={Receipt}
        hint={
          totals.expenses > 0
            ? t('summary.expensesHint', { total: show(totals.expenses) })
            : undefined
        }
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
  /** Optional caption under the figure (e.g. the gross expense total). */
  hint?: string;
}) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? 'border-brand-gold/40 bg-brand-gold-soft' : 'border-neutral-200 bg-white'}`}>
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        <Icon className="size-3.5 text-brand-gold-text" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate font-display text-xl font-semibold text-neutral-950 tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-neutral-400 tabular-nums">{hint}</div>}
    </div>
  );
}
