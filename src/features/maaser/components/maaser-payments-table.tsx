'use client';

import { useOptimistic, useTransition } from 'react';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { formatCurrency } from '@/lib/utils/format-currency';
import type { Locale } from '@/lib/i18n/direction';

import { deleteMaaserPaymentAction } from '../actions/delete-maaser-payment';
import type { MaaserPayment } from '../types';

type Props = {
  payments: ReadonlyArray<MaaserPayment>;
  locale: Locale;
  /** When false, amounts are redacted (shared eye toggle from MaaserView). */
  revealed: boolean;
  mask: string;
};

export function MaaserPaymentsTable({ payments, locale, revealed, mask }: Props) {
  const t = useTranslations('maaser.table');
  const [pending, startTransition] = useTransition();
  const [optimisticPayments, removeOptimisticPayment] = useOptimistic(
    payments,
    (current, id: string) => current.filter((payment) => payment.id !== id),
  );

  const fmtDate = (iso: string): string =>
    new Date(iso).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB');

  const remove = (id: string) => {
    startTransition(async () => {
      // Remove the row immediately. React restores it automatically if the
      // action fails; on success revalidatePath supplies the canonical list.
      removeOptimisticPayment(id);
      try {
        const res = await deleteMaaserPaymentAction(id);
        if (!res.ok) {
          toast.error(t(`errors.${res.error}`));
          return;
        }
      } catch {
        // A Server Action is a network request. Connection changes/offline
        // moments reject it before it can return our typed Result; keep that
        // expected failure inside the interaction instead of tripping the
        // route-level error boundary.
        toast.error(t('errors.unknown'));
      }
    });
  };

  if (optimisticPayments.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-400">{t('empty')}</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
            <th className="px-3 py-2 text-start font-medium">{t('date')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('amount')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('recipient')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('note')}</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {optimisticPayments.map((p) => (
            <tr key={p.id} className="border-b border-neutral-100 last:border-0">
              <td className="whitespace-nowrap px-3 py-2 text-neutral-600 tabular-nums">{fmtDate(p.paidOn)}</td>
              <td className="whitespace-nowrap px-3 py-2 font-semibold text-neutral-900 tabular-nums">
                {revealed ? formatCurrency(p.amount, locale) : mask}
              </td>
              <td className="px-3 py-2 text-neutral-700">{p.recipient || '—'}</td>
              <td className="px-3 py-2 text-neutral-500">{p.note || ''}</td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
