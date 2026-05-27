'use client';

import { useTransition } from 'react';

import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { createEmptyObligationAction } from '../actions/create-empty-obligation';
import { ObligationTableRow } from './obligation-table-row';
import type { ObligationRow as ObligationRowData } from '../types';

type Props = {
  caseId: string;
  /** Primary borrower's id — new obligations are billed to them. Null when
   *  the case has no borrowers yet (Add disabled in that case). */
  primaryBorrowerId: string | null;
  obligations: ReadonlyArray<ObligationRowData>;
  monthlyPaymentTotal: number;
  remainingDebtTotal: number;
  locale: 'he' | 'en';
  canEdit: boolean;
};

/**
 * Case-level obligations rendered as a flat table — five columns
 * (lender / months / end date / monthly / loan balance) plus a per-row
 * delete. No dialog, no per-borrower groups; obligations are
 * case-scope. "+ Add" inserts an empty row right inside the table and
 * the user fills the cells in place.
 *
 * Empty state shows a single dashed CTA matching the borrower-incomes
 * empty state, so all three case blocks (borrowers / incomes /
 * obligations) read the same way before any data is entered.
 */
export function CaseObligationsList({
  caseId,
  primaryBorrowerId,
  obligations,
  monthlyPaymentTotal,
  remainingDebtTotal,
  locale,
  canEdit,
}: Props) {
  const t = useTranslations('obligations');
  const tf = useTranslations('obligations.fields');
  const tc = useTranslations('common');
  const [isAdding, startAdd] = useTransition();

  // monthlyPaymentTotal / remainingDebtTotal are kept on the prop type
  // (callers still pass them) so the parent block header can show a
  // grand total. The inline list above the table used to duplicate that
  // summary on the +Add row — the user found it redundant, so the
  // totals are no longer rendered here. Reference the props via void
  // so eslint doesn't flag them as unused.
  void monthlyPaymentTotal;
  void remainingDebtTotal;
  void locale;

  const canAdd = canEdit && primaryBorrowerId !== null;

  const handleAdd = () => {
    if (!canAdd || !primaryBorrowerId) return;
    startAdd(async () => {
      const result = await createEmptyObligationAction(caseId, primaryBorrowerId);
      if (!result.ok) toast.error(result.message || tc('saveFailed'));
    });
  };

  const hasObligations = obligations.length > 0;

  return (
    <div className="space-y-3">
      {canAdd && hasObligations && (
        // Add-button-only header — the totals row sat here previously but
        // duplicated the outer CaseBlock's grand-total header, so it was
        // dropped per user request.
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleAdd}
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

      {!hasObligations ? (
        canAdd ? (
          // Same dashed gold CTA as the borrower-incomes empty state so the
          // three blocks (borrowers / incomes / obligations) read alike
          // before any data is entered.
          <button
            type="button"
            onClick={handleAdd}
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
              <tr className="text-right">
                <Th>{tf('loanAmount')}</Th>
                <Th>{tf('monthlyPayment')}</Th>
                <Th>{tf('endDate')}</Th>
                <Th>{tf('monthsRemaining')}</Th>
                <Th>{tf('lender')}</Th>
                <th aria-hidden="true" className="w-9" />
              </tr>
            </thead>
            <tbody>
              {obligations.map((ob) => (
                <ObligationTableRow
                  key={ob.id}
                  caseId={caseId}
                  obligation={ob}
                  canEdit={canEdit}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
