'use client';

import { useOptimistic, useTransition } from 'react';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { formatCurrency } from '@/lib/utils/format-currency';
import type { Locale } from '@/lib/i18n/direction';

import { deleteMaaserEntryAction } from '../actions/delete-maaser-entry';
import type { MaaserEntry } from '../types';

type Props = {
  entries: ReadonlyArray<MaaserEntry>;
  locale: Locale;
  /** When false, amounts are redacted (shared eye toggle from MaaserView). */
  revealed: boolean;
  mask: string;
};

export function MaaserEntriesTable({ entries, locale, revealed, mask }: Props) {
  const t = useTranslations('maaser.entriesTable');
  const [pending, startTransition] = useTransition();
  const [optimisticEntries, removeOptimisticEntry] = useOptimistic(
    entries,
    (current, id: string) => current.filter((entry) => entry.id !== id),
  );

  const fmtDate = (iso: string): string =>
    new Date(iso).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB');

  const remove = (id: string) => {
    startTransition(async () => {
      // Remove the row immediately. React restores it if the action fails; on
      // success revalidatePath supplies the canonical list.
      removeOptimisticEntry(id);
      try {
        const res = await deleteMaaserEntryAction(id);
        if (!res.ok) {
          toast.error(t(`errors.${res.error}`));
          return;
        }
      } catch {
        toast.error(t('errors.unknown'));
      }
    });
  };

  if (optimisticEntries.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-400">{t('empty')}</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
            <th className="px-3 py-2 text-start font-medium">{t('date')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('kind')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('amount')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('description')}</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {optimisticEntries.map((e) => {
            const income = e.kind === 'income';
            return (
              <tr key={e.id} className="border-b border-neutral-100 last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-neutral-600 tabular-nums">{fmtDate(e.entryDate)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      income ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {income ? t('income') : t('expense')}
                  </span>
                </td>
                <td
                  className={`whitespace-nowrap px-3 py-2 font-semibold tabular-nums ${
                    income ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {revealed ? `${income ? '+' : '−'}${formatCurrency(e.amount, locale)}` : mask}
                </td>
                <td className="px-3 py-2 text-neutral-500">{e.description || ''}</td>
                <td className="px-3 py-2 text-end">
                  <button
                    type="button"
                    onClick={() => remove(e.id)}
                    disabled={pending}
                    aria-label={t('delete')}
                    className="tap-target inline-flex size-7 items-center justify-center rounded-md text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
