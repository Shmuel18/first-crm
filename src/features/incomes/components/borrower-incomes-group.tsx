'use client';

import { useTransition } from 'react';

import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { createEmptyIncomeAction } from '../actions/create-empty-income';
import { IncomeRow } from './income-row';
import type { IncomeTypeOption, IncomeWithType } from '../types';

type Props = {
  caseId: string;
  borrowerId: string;
  borrowerName: string;
  incomes: ReadonlyArray<IncomeWithType>;
  monthlyTotal: number;
  incomeTypes: ReadonlyArray<IncomeTypeOption>;
  locale: 'he' | 'en';
  canEdit: boolean;
};

/**
 * Per-borrower income list. Each existing income renders as a small card with
 * every field inline-editable (no dialog). "+ Add income" creates an empty
 * row server-side and revalidates — the new card appears in the list and the
 * advisor fills its cells in place.
 */
export function BorrowerIncomesGroup({
  caseId,
  borrowerId,
  borrowerName,
  incomes,
  monthlyTotal,
  incomeTypes,
  locale,
  canEdit,
}: Props) {
  const t = useTranslations('incomes');
  const tc = useTranslations('common');
  const [isAdding, startAdd] = useTransition();

  const fmt = new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });

  const handleAdd = () => {
    startAdd(async () => {
      const result = await createEmptyIncomeAction(caseId, borrowerId);
      if (!result.ok) {
        toast.error(result.message || tc('saveFailed'));
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-neutral-100">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-medium text-neutral-900 truncate">{borrowerName}</span>
          <span className="text-xs text-neutral-500 shrink-0">
            {t('monthlyTotal')}:{' '}
            <span className="font-semibold text-neutral-800">{fmt.format(monthlyTotal)}</span>
          </span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={isAdding}
            className="inline-flex items-center gap-1 text-xs text-[#A88840] hover:text-[#0A0A0A] font-medium transition disabled:opacity-50"
          >
            {isAdding ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-3.5" aria-hidden="true" />
            )}
            {t('addIncome')}
          </button>
        )}
      </div>

      {incomes.length === 0 ? (
        <p className="text-xs text-neutral-500 italic py-2">{t('empty')}</p>
      ) : (
        <ul className="space-y-2">
          {incomes.map((inc) => (
            <IncomeRow
              key={inc.id}
              caseId={caseId}
              income={inc}
              incomeTypes={incomeTypes}
              locale={locale}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
