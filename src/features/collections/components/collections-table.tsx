'use client';

import Link from 'next/link';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { rowDueNow } from '../domain/collections-overview-calc';
import type { EnrichedCollectionRow } from '../domain/collections-overview-calc';
import type { CollectionStatus } from '../types';

const STATUS_STYLES: Record<CollectionStatus, string> = {
  not_started: 'bg-neutral-100 text-neutral-600',
  partial: 'bg-brand-gold-soft text-brand-gold-text',
  collected: 'bg-emerald-50 text-emerald-700',
  overpaid: 'bg-amber-50 text-amber-700',
};

type Props = {
  rows: ReadonlyArray<EnrichedCollectionRow>;
  /** manage_collections — gates the inline "record payment" action. */
  canManage: boolean;
  /** Formats money, or masks it while the screen is hidden. */
  show: (v: number) => string;
  fmtDate: (iso: string | null) => string;
  onAddPayment: (row: EnrichedCollectionRow) => void;
};

/** Per-case table: what each client owes, most outstanding first. */
export function CollectionsTable({ rows, canManage, show, fmtDate, onAddPayment }: Props) {
  const t = useTranslations('collections');

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
            <th className="sticky start-0 z-10 bg-neutral-50 px-3 py-2 text-start font-medium">{t('overview.client')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('overview.feeDue')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('overview.expensesDue')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('overview.collected')}</th>
            <th className="px-3 py-2 text-start font-semibold text-neutral-700">{t('overview.dueNow')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('overview.status')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('overview.lastPayment')}</th>
            {canManage && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            // Only what is collectible NOW, never the lifetime total. Office
            // expenses are due as soon as they are incurred; the fee is not —
            // pre-execution only the agreed advance is due, the rest becomes
            // collectible at execution. Showing a full fee against a case that
            // is still collecting documents puts money the client does not owe
            // yet in front of the collector.
            //
            // So the two components are already-net figures and they simply
            // add up: fee-due + expenses-due = due now. Each column says
            // "לגבייה" so none of them reads as a lifetime total — that
            // ambiguity is what made an earlier version unreadable.
            const dueNow = rowDueNow(r);
            // A green 0 means "money came in and cleared what was due". Gate it
            // on an actual payment: a lead with an agreed fee also owes nothing
            // YET, and marking that green would read as paid-in-full.
            const settled = dueNow <= 0 && r.collected > 0;

            return (
              <tr key={r.caseId} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60">
                <td className="sticky start-0 z-10 bg-white px-3 py-2">
                  <Link
                    href={`/cases/${r.caseId}`}
                    className="font-medium text-brand-gold-text hover:underline"
                  >
                    {r.borrowers || r.caseNumber}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-700 tabular-nums">
                  {r.feeBalance > 0
                    ? show(r.feeBalance)
                    : <span className="text-neutral-300">—</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-700 tabular-nums">
                  {r.expenseBalance > 0
                    ? show(r.expenseBalance)
                    : <span className="text-neutral-300">—</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                  {r.collected > 0
                    ? <span className="font-medium text-emerald-700">{show(r.collected)}</span>
                    : <span className="text-neutral-300">—</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                  {dueNow > 0 ? (
                    <span className="font-bold text-neutral-900">{show(dueNow)}</span>
                  ) : settled ? (
                    <span className="font-semibold text-emerald-600">{show(0)}</span>
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
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
                      onClick={() => onAddPayment(r)}
                      className="inline-flex items-center gap-1 rounded-md border border-brand-gold/50 px-2 py-1 text-xs font-medium text-brand-gold-text transition hover:bg-brand-gold-soft"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      {t('block.add')}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
