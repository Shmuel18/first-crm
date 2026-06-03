'use client';

import { useMemo, useState, useTransition } from 'react';

import { CreditCard, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { CaseBlock } from '@/features/cases/components/case-block';
import { formatCurrency } from '@/lib/utils/format-currency';

import { createEmptyObligationAction } from '../actions/create-empty-obligation';
import { deleteObligationAction } from '../actions/delete-obligation';
import {
  updateObligationFieldAction,
  type EditableObligationField,
} from '../actions/update-obligation-field';
import { monthsUntil } from '../domain/months-remaining';
import { sumMonthlyPayments } from '../domain/totals';
import { emptyObligationRow } from './obligation-empty-row';
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
 * Owns the obligations list as client state so inline edits, adds and deletes
 * update in place — the grand-total header recomputes from the same state and
 * the rest of the heavy case page is NOT re-rendered. Previously every mutation
 * called revalidatePath, which re-fetched/reflowed all blocks and threw away the
 * user's scroll position (the "jumps to top" report). Mirrors the case-banks
 * optimistic pattern; resyncs to server truth whenever the props change.
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
  const tc = useTranslations('common');

  const [rows, setRows] = useState<ObligationRow[]>(() => [...initialObligations]);
  const sig = initialObligations
    .map(
      (r) =>
        `${r.id}:${r.monthly_payment ?? ''}:${r.loan_amount ?? ''}:${r.end_date ?? ''}:${r.months_remaining ?? ''}:${r.lender ?? ''}`,
    )
    .join('|');
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig);
    setRows([...initialObligations]);
  }

  const [isAdding, startAdd] = useTransition();

  const monthlyTotal = useMemo(() => sumMonthlyPayments(rows), [rows]);

  const canAdd = canEdit && primaryBorrowerId !== null;
  const hasRows = rows.length > 0;

  const handleAdd = () => {
    if (!canAdd || !primaryBorrowerId) return;
    const tempId = `optimistic-${prevSig.length}-${rows.length}`;
    setRows((prev) => [...prev, emptyObligationRow(tempId, primaryBorrowerId)]);
    startAdd(async () => {
      const result = await createEmptyObligationAction(caseId, primaryBorrowerId);
      if (!result.ok) {
        setRows((prev) => prev.filter((r) => r.id !== tempId));
        toast.error(result.message || tc('saveFailed'));
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.id === tempId ? { ...r, id: result.obligationId } : r)),
      );
    });
  };

  const handleDelete = (id: string) => {
    const index = rows.findIndex((r) => r.id === id);
    const removed = rows[index];
    if (!removed) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    void deleteObligationAction(id, removed.borrower_id, caseId).then((result) => {
      if (result.ok) {
        toast.success(t('deleteSuccess'));
        return;
      }
      setRows((prev) => {
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, removed);
        return next;
      });
      toast.error(t('deleteError'));
    });
  };

  const saveField = async (id: string, field: EditableObligationField, value: unknown) => {
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    const prev = target[field];
    // `as never` for the computed-key write: EditableObligationField spans
    // string/number/null columns, so a dynamic [field] assignment can't be
    // proven type-safe at compile time; the action validates the field+value.
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, [field]: value as never } : r)));
    const result = await updateObligationFieldAction(id, caseId, field, value);
    if (!result.ok) {
      setRows((cur) => cur.map((r) => (r.id === id ? { ...r, [field]: prev as never } : r)));
      return;
    }

    // Smart default: filling end_date derives months_remaining from it (the
    // reverse is left manual). Clearing end_date leaves months as-is.
    if (field === 'end_date' && typeof value === 'string' && value) {
      const prevMonths = target.months_remaining;
      const months = monthsUntil(value);
      setRows((cur) =>
        cur.map((r) => (r.id === id ? { ...r, months_remaining: months } : r)),
      );
      const monthsResult = await updateObligationFieldAction(id, caseId, 'months_remaining', months);
      if (!monthsResult.ok) {
        setRows((cur) =>
          cur.map((r) => (r.id === id ? { ...r, months_remaining: prevMonths } : r)),
        );
      }
    }
  };

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

          {!hasRows ? (
            canAdd ? (
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
                  {rows.map((ob) => (
                    <ObligationTableRow
                      key={ob.id}
                      obligation={ob}
                      canEdit={canEdit}
                      onSaveField={(field, value) => saveField(ob.id, field, value)}
                      onDelete={() => handleDelete(ob.id)}
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
