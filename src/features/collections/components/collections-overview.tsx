'use client';

import { useMemo, useState } from 'react';

import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsStringEnum, useQueryState } from 'nuqs';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useInlineMutationSync } from '@/lib/hooks/use-inline-mutation-sync';
import { formatCurrency } from '@/lib/utils/format-currency';
import type { Locale } from '@/lib/i18n/direction';

import {
  COLLECTION_FILTERS,
  enrichCollectionRows,
  primaryBorrowerName,
  selectVisibleRows,
} from '../domain/collections-overview-calc';
import type { CollectionFilter, EnrichedCollectionRow } from '../domain/collections-overview-calc';
import type { CollectionOverviewRow } from '../types';
import { CollectionsSummaryCards } from './collections-summary-cards';
import { CollectionsTable } from './collections-table';
import { FeePaymentForm } from './fee-payment-form';

type Props = {
  rows: ReadonlyArray<CollectionOverviewRow>;
  /** manage_collections — gates the inline "record payment" action. */
  canManage: boolean;
  /** Today (Israel TZ), server-computed, for the inline payment form. */
  defaultDate: string;
  locale: Locale;
};

const MASK = '••••••';

export function CollectionsOverview({ rows, canManage, defaultDate, locale }: Props) {
  const t = useTranslations('collections');
  const [revealed, setRevealed] = useState(false);
  const [payCase, setPayCase] = useState<{ caseId: string; name: string } | null>(null);
  // The collections actions skip revalidatePath (FE-1), so without this the
  // server-fetched rows/totals and the router cache would keep the
  // pre-payment payload until a hard reload. There's no optimistic row state
  // here — the debounced background router.refresh re-fetches the overview.
  const { beginOp, endOp, refreshSoon } = useInlineMutationSync();
  const [filter, setFilter] = useQueryState(
    'status',
    parseAsStringEnum<CollectionFilter>([...COLLECTION_FILTERS]).withDefault('open'),
  );

  const enriched = useMemo(() => enrichCollectionRows(rows), [rows]);
  const visible = selectVisibleRows(enriched, filter);

  const show = (v: number): string => (revealed ? formatCurrency(v, locale) : MASK);
  const fmtDate = (iso: string | null): string =>
    iso ? new Date(iso).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB') : '—';
  const RevealIcon = revealed ? EyeOff : Eye;

  const openPaymentDialog = (row: EnrichedCollectionRow): void => {
    setPayCase({ caseId: row.caseId, name: primaryBorrowerName(row) });
  };

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

      <CollectionsSummaryCards rows={enriched} show={show} />

      {/* Status filter */}
      <div role="group" aria-label={t('filter.label')} className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-neutral-100 p-0.5">
        {COLLECTION_FILTERS.map((f) => (
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

      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-400">{t('overview.empty')}</p>
      ) : (
        <CollectionsTable
          rows={visible}
          canManage={canManage}
          show={show}
          fmtDate={fmtDate}
          onAddPayment={openPaymentDialog}
        />
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
              onMutateStart={beginOp}
              onMutateSettled={(ok) => {
                endOp();
                if (ok) refreshSoon();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
