'use client';

import { useMemo } from 'react';

import { CreditCard, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CaseBlock } from '@/features/cases/components/case-block';
import { formatCurrency } from '@/lib/utils/format-currency';

import { sumMonthlyPayments } from '../domain/totals';
import { useObligationRows } from '../hooks/use-obligation-rows';
import { ObligationTableRow } from './obligation-table-row';
import type { ObligationRow } from '../types';

type Props = {
  caseId: string;
  /** Primary borrower's id — new obligations are billed to them. Null when the
   *  case has no borrowers yet (Add disabled + a "no borrowers" notice shown). */
  primaryBorrowerId: string | null;
  initialObligations: ReadonlyArray<ObligationRow>;
  locale: 'he' | 'en';
  canEdit: boolean;
};

/**
 * Renders the obligations block; state lives in useObligationRows (optimistic
 * add / delete / blur-save so the heavy case page never re-renders + the
 * debounced background router.refresh that keeps the router cache from
 * restoring the pre-mutation page). The grand-total header recomputes from
 * the same client state.
 */
export function CaseObligationsClient({
  caseId,
  primaryBorrowerId,
  initialObligations,
  locale,
  canEdit,
}: Props) {
  const t = useTranslations('obligations');
  const tf = useTranslations('obligations.fields');

  const { rows, isAdding, addRow, deleteRow, saveField, rowKey } = useObligationRows(
    caseId,
    primaryBorrowerId,
    initialObligations,
  );

  const monthlyTotal = useMemo(() => sumMonthlyPayments(rows), [rows]);

  const canAdd = canEdit && primaryBorrowerId !== null;
  const hasRows = rows.length > 0;

  return (
    <CaseBlock
      title={t('blockTitle')}
      icon={<CreditCard />}
      fullWidth
      blockKey="obligations"
      rightSlot={
        monthlyTotal > 0 && (
          <span className="text-xs text-neutral-600">
            {t('grandTotal')}:{' '}
            <span className="font-semibold text-neutral-900">
              {formatCurrency(monthlyTotal, locale)}
            </span>
          </span>
        )
      }
    >
      {primaryBorrowerId === null ? (
        <p className="text-sm text-neutral-600 text-center py-4">{t('noBorrowers')}</p>
      ) : (
        <div className="space-y-3">
          {canAdd && hasRows && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={addRow}
                disabled={isAdding}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-gold-text bg-brand-gold-soft border border-brand-gold/40 rounded-full px-2.5 py-1 hover:bg-brand-gold/20 hover:border-brand-gold/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-3.5" aria-hidden="true" />
                )}
                {t('addObligation')}
              </button>
            </div>
          )}

          {!hasRows ? (
            canAdd ? (
              <button
                type="button"
                onClick={addRow}
                disabled={isAdding}
                className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium text-brand-gold-text bg-brand-gold-soft border border-dashed border-brand-gold/50 rounded-md px-3 py-3 hover:bg-brand-gold/20 hover:border-brand-gold/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Plus aria-hidden="true" className="size-4" />
                )}
                {t('addFirstObligation')}
              </button>
            ) : (
              <p className="text-xs text-neutral-500 italic text-center py-3">{t('empty')}</p>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="text-start">
                    <Th>{tf('loanAmount')}</Th>
                    <Th>{tf('monthlyPayment')}</Th>
                    <Th>{tf('endDate')}</Th>
                    <Th>{tf('monthsRemaining')}</Th>
                    <Th>{tf('lender')}</Th>
                    <th aria-hidden="true" className="w-9" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((ob) => (
                    <ObligationTableRow
                      key={rowKey(ob.id)}
                      obligation={ob}
                      canEdit={canEdit}
                      onSaveField={(field, value) => saveField(ob.id, field, value)}
                      onDelete={() => deleteRow(ob.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </CaseBlock>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-1.5 py-2 text-xs font-medium text-neutral-600 text-start border-b border-neutral-200"
    >
      {children}
    </th>
  );
}
