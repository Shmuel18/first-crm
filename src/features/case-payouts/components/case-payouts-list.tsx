'use client';

import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { usePayoutRows } from '../hooks/use-payout-rows';
import { CasePayoutRow } from './case-payout-row';

import type { CasePayoutRow as CasePayoutRowData } from '../types';

type Props = {
  caseId: string;
  payouts: ReadonlyArray<CasePayoutRowData>;
  canEdit: boolean;
};

/**
 * Manager-only commissions/salaries list inside the admin block — recipient +
 * amount per row, inline-edit, optimistic add/delete (no revalidatePath, to
 * avoid the heavy case-page re-render). Mirrors CaseExpensesList: all state
 * lives in usePayoutRows (incl. the debounced background router.refresh that
 * keeps the router cache from restoring the pre-mutation page).
 */
export function CasePayoutsList({ caseId, payouts, canEdit }: Props) {
  const t = useTranslations('payouts');
  const tf = useTranslations('payouts.fields');
  const { rows, isAdding, addRow, deleteRow, saveField, rowKey } = usePayoutRows(caseId, payouts);

  const addButton = canEdit ? (
    <button
      type="button"
      onClick={addRow}
      disabled={isAdding}
      className="inline-flex items-center gap-1 text-xs font-medium text-brand-gold-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 rounded disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isAdding ? (
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="size-3" aria-hidden="true" />
      )}
      {t('add')}
    </button>
  ) : null;

  if (rows.length === 0) {
    return (
      <div className="py-2 text-xs text-neutral-500 flex items-center justify-between gap-3">
        <span className="italic">{t('empty')}</span>
        {addButton}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="text-start">
              <Th>{tf('recipient')}</Th>
              <Th>{tf('amount')}</Th>
              <th aria-hidden="true" className="w-9" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <CasePayoutRow
                key={rowKey(p.id)}
                payout={p}
                canEdit={canEdit}
                onSaveField={(field, value) => saveField(p.id, field, value)}
                onDelete={() => deleteRow(p.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end pt-1">{addButton}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-1.5 py-1.5 text-xs font-medium text-neutral-600 text-start border-b border-neutral-200"
    >
      {children}
    </th>
  );
}
