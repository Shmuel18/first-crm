'use client';

import { useOptimistic, useTransition } from 'react';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { formatCurrency } from '@/lib/utils/format-currency';
import type { Locale } from '@/lib/i18n/direction';

import { deleteFeePaymentAction } from '../actions/delete-fee-payment';
import type { FeePayment } from '../types';

type Props = {
  caseId: string;
  payments: ReadonlyArray<FeePayment>;
  locale: Locale;
  /** Hide the delete column for a view-only (no manage_collections) caller. */
  canManage: boolean;
};

export function FeePaymentsTable({ caseId, payments, locale, canManage }: Props) {
  const t = useTranslations('collections.table');
  const tMethod = useTranslations('collections.method');
  const [pending, startTransition] = useTransition();
  const [optimistic, removeOptimistic] = useOptimistic(payments, (current, id: string) =>
    current.filter((p) => p.id !== id),
  );

  const fmtDate = (iso: string | null): string =>
    iso ? new Date(iso).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB') : '—';

  const remove = (id: string) => {
    startTransition(async () => {
      removeOptimistic(id);
      try {
        const res = await deleteFeePaymentAction(caseId, id);
        if (!res.ok) {
          toast.error(t(`errors.${res.error}`));
          return;
        }
      } catch {
        toast.error(t('errors.unknown'));
      }
    });
  };

  if (optimistic.length === 0) {
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
          {optimistic.map((p) => (
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
                    onClick={() => remove(p.id)}
                    disabled={pending}
                    aria-label={t('delete')}
                    className="inline-flex size-7 items-center justify-center rounded-md text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
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
