'use client';

import { Loader2, Plus, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatCurrency } from '@/lib/utils/format-currency';

import { type EditableIncomeField } from '../actions/update-income-field';
import { IncomeRow } from './income-row';
import type { IncomeSaveResult, IncomeTypeOption, IncomeWithType } from '../types';

type Props = {
  borrowerName: string;
  incomes: ReadonlyArray<IncomeWithType>;
  monthlyTotal: number;
  incomeTypes: ReadonlyArray<IncomeTypeOption>;
  locale: 'he' | 'en';
  canEdit: boolean;
  isAdding: boolean;
  /** Stable React key — survives the temp -> real id swap (no remount that
   *  would wipe a cell the user is typing in). */
  rowKey: (id: string) => string;
  onAdd: () => void;
  onSaveField: (incomeId: string, field: EditableIncomeField, value: unknown) => Promise<IncomeSaveResult>;
  onDelete: (incomeId: string) => void;
};

/**
 * Per-borrower income list — presentational. The parent (CaseIncomesClient)
 * owns the optimistic state, the eager "primary employment" init, and the
 * subtotal/grand-total math; this component only renders the card + delegates
 * add / edit / delete to callbacks.
 */
export function BorrowerIncomesGroup({
  borrowerName,
  incomes,
  monthlyTotal,
  incomeTypes,
  locale,
  canEdit,
  isAdding,
  rowKey,
  onAdd,
  onSaveField,
  onDelete,
}: Props) {
  const t = useTranslations('incomes');

  return (
    <div className="border border-neutral-200 rounded-lg p-4 bg-white space-y-3">
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-9 rounded-full bg-brand-gold-soft flex items-center justify-center shrink-0">
            <Wallet aria-hidden="true" className="size-5 text-brand-gold-text" />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-neutral-900 text-sm truncate">{borrowerName}</span>
            <span className="text-xs text-neutral-500">
              {t('monthlyTotal')}:{' '}
              <span className="font-semibold text-neutral-800">
                {formatCurrency(monthlyTotal, locale)}
              </span>
            </span>
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onAdd}
            disabled={isAdding}
            className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-gold-text bg-brand-gold-soft border border-brand-gold/40 rounded-full px-2.5 py-1 hover:bg-brand-gold/20 hover:border-brand-gold/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 disabled:opacity-50 disabled:cursor-not-allowed"
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
        // Brief skeleton while the eager-init optimistic add lands — without it
        // the group flashes a blank body for one tick, which reads as "broken".
        canEdit ? (
          <div className="h-24 rounded-md bg-neutral-50 animate-pulse" aria-hidden="true" />
        ) : (
          <p className="text-xs text-neutral-500 italic text-center py-3">{t('empty')}</p>
        )
      ) : (
        <ul className="space-y-2">
          {incomes.map((inc, index) => (
            <IncomeRow
              key={rowKey(inc.id)}
              income={inc}
              incomeTypes={incomeTypes}
              locale={locale}
              canEdit={canEdit}
              // First income is the borrower's primary employment slot — it must
              // always exist (mirrored by the parent's eager init), so the row
              // hides its delete. Additional incomes keep their trash.
              canDelete={index > 0}
              onSaveField={(field, value) => onSaveField(inc.id, field, value)}
              onDelete={() => onDelete(inc.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
