'use client';

import { useState, useTransition } from 'react';

import { Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/utils/format-currency';

import { deleteObligationAction } from '../actions/delete-obligation';
import { ObligationFormDialog } from './obligation-form-dialog';
import type { ObligationRow } from '../types';

type Props = {
  caseId: string;
  borrowerId: string;
  borrowerName: string;
  obligations: ReadonlyArray<ObligationRow>;
  monthlyPaymentTotal: number;
  remainingDebtTotal: number;
  locale: 'he' | 'en';
  canEdit: boolean;
};

type DialogState =
  | { mode: 'closed' }
  | { mode: 'new' }
  | { mode: 'edit'; obligation: ObligationRow };

/**
 * Renders one borrower's obligations — list + per-borrower monthly payment
 * and remaining-debt totals + add button. Mirrors BorrowerIncomesGroup.
 */
export function BorrowerObligationsGroup({
  caseId,
  borrowerId,
  borrowerName,
  obligations,
  monthlyPaymentTotal,
  remainingDebtTotal,
  locale,
  canEdit,
}: Props) {
  const t = useTranslations('obligations');
  const tc = useTranslations('common');
  const [dialog, setDialog] = useState<DialogState>({ mode: 'closed' });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ObligationRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (obligation: ObligationRow) => {
    setDeletingId(obligation.id);
    startTransition(async () => {
      const result = await deleteObligationAction(obligation.id, obligation.borrower_id, caseId);
      setDeletingId(null);
      if (result.ok) {
        toast.success(t('deleteSuccess'));
      } else {
        toast.error(t('deleteError'));
      }
    });
  };

  return (
    // Outer wrapper mirrors CaseBorrowerCard / BorrowerIncomesGroup — same
    // border, padding, and icon-disk header so all three per-borrower
    // groupings read as the same visual family.
    <div className="border border-neutral-200 rounded-lg p-4 bg-white space-y-3">
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-9 rounded-full bg-brand-gold-soft flex items-center justify-center shrink-0">
            <Scale aria-hidden="true" className="size-5 text-brand-gold-text" />
          </span>
          <div className="flex flex-col min-w-0 gap-0.5">
            <span className="font-medium text-neutral-900 text-sm truncate">{borrowerName}</span>
            <span className="text-xs text-neutral-500 flex items-center gap-2 flex-wrap">
              <span>
                {t('monthlyTotal')}:{' '}
                <span className="font-semibold text-neutral-800">
                  {formatCurrency(monthlyPaymentTotal, locale)}
                </span>
              </span>
              {remainingDebtTotal > 0 && (
                <span>
                  · {t('remainingTotal')}:{' '}
                  <span className="font-semibold text-neutral-800">
                    {formatCurrency(remainingDebtTotal, locale)}
                  </span>
                </span>
              )}
            </span>
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setDialog({ mode: 'new' })}
            className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-gold-text bg-brand-gold-soft border border-brand-gold/40 rounded-full px-2.5 py-1 hover:bg-brand-gold/20 hover:border-brand-gold/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t('addObligation')}
          </button>
        )}
      </div>

      {obligations.length === 0 ? (
        <p className="text-xs text-neutral-500 italic py-2">{t('empty')}</p>
      ) : (
        <ul className="space-y-1.5">
          {obligations.map((ob) => (
            <li
              key={ob.id}
              className="group flex items-center justify-between gap-3 px-2 py-1.5 rounded hover:bg-neutral-50 transition"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0 text-sm">
                <span className="font-medium text-neutral-800 shrink-0">
                  {ob.lender || t('unnamedLender')}
                </span>
                {ob.description && (
                  <span className="text-xs text-neutral-500 truncate">· {ob.description}</span>
                )}
                {ob.months_remaining !== null && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 shrink-0">
                    {t('monthsLeft', { count: ob.months_remaining })}
                  </span>
                )}
              </div>
              <span className="font-mono text-sm text-neutral-900 shrink-0" dir="ltr">
                {ob.monthly_payment !== null ? formatCurrency(Number(ob.monthly_payment), locale) : '—'}
              </span>
              {canEdit && (
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition">
                  <Tooltip content={tc('edit')}>
                    <button
                      type="button"
                      onClick={() => setDialog({ mode: 'edit', obligation: ob })}
                      aria-label={tc('edit')}
                      className="size-6 rounded flex items-center justify-center text-neutral-500 hover:text-brand-gold-text hover:bg-white transition"
                    >
                      <Pencil className="size-3" aria-hidden="true" />
                    </button>
                  </Tooltip>
                  <Tooltip content={tc('delete')}>
                    <button
                      type="button"
                      onClick={() => setConfirmTarget(ob)}
                      disabled={isPending && deletingId === ob.id}
                      aria-label={tc('delete')}
                      className="size-6 rounded flex items-center justify-center text-neutral-500 hover:text-red-600 hover:bg-white transition disabled:opacity-50"
                    >
                      <Trash2 className="size-3" aria-hidden="true" />
                    </button>
                  </Tooltip>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {dialog.mode !== 'closed' && (
        <ObligationFormDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog({ mode: 'closed' });
          }}
          caseId={caseId}
          borrowerId={borrowerId}
          borrowerName={borrowerName}
          obligation={dialog.mode === 'edit' ? dialog.obligation : null}
        />
      )}

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{tc('delete')}</AlertDialogTitle>
          <AlertDialogDescription>{t('confirmDelete')}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirmTarget) handleDelete(confirmTarget);
                    setConfirmTarget(null);
                  }}
                  disabled={isPending}
                >
                  {tc('delete')}
                </Button>
              }
            />
            <AlertDialogCancel render={<Button variant="outline">{tc('cancel')}</Button>} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
