'use client';

import { Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatCurrency } from '@/lib/utils/format-currency';
import type { Locale } from '@/lib/i18n/direction';

import type { FeePayment } from '../types';

type Props = {
  payments: ReadonlyArray<FeePayment>;
  locale: Locale;
  /** Hide the delete column for a view-only (no manage_collections) caller. */
  canManage: boolean;
  /** Delete is owned by the parent, which keeps the optimistic list + summary. */
  onDelete?: (id: string) => void;
  /** Row currently being deleted — shows a spinner + disables its button. */
  deletingId?: string | null;
};

/** Presentational ledger of fee payments. The list + add/delete state live in
 *  the parent so a mutation never has to revalidate the heavy case page. */
export function FeePaymentsTable({ payments, locale, canManage, onDelete, deletingId }: Props) {
  const t = useTranslations('collections.table');
  const tMethod = useTranslations('collections.method');

  const fmtDate = (iso: string | null): string =>
    iso ? new Date(iso).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB') : '—';

  if (payments.length === 0) {
    return <p className="py-6 text-center text-sm text-neutral-400">{t('empty')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
            <th className="px-3 py-2 text-start font-medium">{t('date')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('amount')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('method')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('label')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('note')}</th>
            {canManage && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-b border-neutral-100 last:border-0">
              <td className="whitespace-nowrap px-3 py-2 text-neutral-600 tabular-nums">
                {fmtDate(p.paidOn)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-semibold text-neutral-900 tabular-nums">
                {formatCurrency(p.amount, locale)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-neutral-700">
                {p.paymentMethod ? tMethod(p.paymentMethod) : '—'}
              </td>
              <td className="px-3 py-2 text-neutral-700">{p.label || '—'}</td>
              <td className="px-3 py-2 text-neutral-500">{p.note || ''}</td>
              {canManage && (
                <td className="px-3 py-2 text-end">
                  <button
                    type="button"
                    onClick={() => onDelete?.(p.id)}
                    disabled={deletingId === p.id}
                    aria-label={t('delete')}
                    className="inline-flex size-7 items-center justify-center rounded-md text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    {deletingId === p.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
