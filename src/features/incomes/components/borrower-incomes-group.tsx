'use client';

import { useState, useTransition } from 'react';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Tooltip } from '@/components/ui/tooltip';

import { deleteIncomeAction } from '../actions/delete-income';
import { IncomeFormDialog } from './income-form-dialog';
import type { IncomeRow, IncomeTypeOption, IncomeWithType } from '../types';

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

type DialogState =
  | { mode: 'closed' }
  | { mode: 'new' }
  | { mode: 'edit'; income: IncomeRow };

/**
 * Renders one borrower's incomes — list of rows + per-borrower monthly total
 * + add button. Each row's edit/delete is colocated so the parent block stays
 * thin (mapping over borrower groups).
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
  const [dialog, setDialog] = useState<DialogState>({ mode: 'closed' });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fmt = new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });

  const handleDelete = (income: IncomeRow) => {
    if (!confirm(t('confirmDelete'))) return;
    setDeletingId(income.id);
    startTransition(async () => {
      const result = await deleteIncomeAction(income.id, income.borrower_id, caseId);
      setDeletingId(null);
      if (result.ok) {
        toast.success(t('deleteSuccess'));
      } else {
        toast.error(t('deleteError'));
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-neutral-100">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-medium text-neutral-900 truncate">{borrowerName}</span>
          <span className="text-xs text-neutral-500 shrink-0">
            {t('monthlyTotal')}: <span className="font-semibold text-neutral-800">{fmt.format(monthlyTotal)}</span>
          </span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setDialog({ mode: 'new' })}
            className="inline-flex items-center gap-1 text-xs text-[#A88840] hover:text-[#0A0A0A] font-medium transition"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t('addIncome')}
          </button>
        )}
      </div>

      {incomes.length === 0 ? (
        <p className="text-xs text-neutral-500 italic py-2">{t('empty')}</p>
      ) : (
        <ul className="space-y-1.5">
          {incomes.map((inc) => {
            const typeLabel =
              inc.income_type === null
                ? t('untyped')
                : locale === 'he'
                  ? inc.income_type.name_he
                  : inc.income_type.name_en;
            return (
              <li
                key={inc.id}
                className="group flex items-center justify-between gap-3 px-2 py-1.5 rounded hover:bg-neutral-50 transition"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0 text-sm">
                  <span className="font-medium text-neutral-800 shrink-0">{typeLabel}</span>
                  {inc.source_name && (
                    <span className="text-xs text-neutral-500 truncate">· {inc.source_name}</span>
                  )}
                  {inc.is_primary && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#C9A961]/15 text-[#8a6b30] font-medium shrink-0">
                      {t('primaryBadge')}
                    </span>
                  )}
                </div>
                <span className="font-mono text-sm text-neutral-900 shrink-0" dir="ltr">
                  {inc.amount_monthly !== null ? fmt.format(Number(inc.amount_monthly)) : '—'}
                </span>
                {canEdit && (
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition">
                    <Tooltip content={tc('edit')}>
                      <button
                        type="button"
                        onClick={() => setDialog({ mode: 'edit', income: inc })}
                        aria-label={tc('edit')}
                        className="size-6 rounded flex items-center justify-center text-neutral-500 hover:text-[#A88840] hover:bg-white transition"
                      >
                        <Pencil className="size-3" aria-hidden="true" />
                      </button>
                    </Tooltip>
                    <Tooltip content={tc('delete')}>
                      <button
                        type="button"
                        onClick={() => handleDelete(inc)}
                        disabled={isPending && deletingId === inc.id}
                        aria-label={tc('delete')}
                        className="size-6 rounded flex items-center justify-center text-neutral-500 hover:text-red-600 hover:bg-white transition disabled:opacity-50"
                      >
                        <Trash2 className="size-3" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {dialog.mode !== 'closed' && (
        <IncomeFormDialog
          // The wrapper conditional already guarantees the dialog is open;
          // useState ensures the form re-mounts (and resets) when toggled.
          open
          onOpenChange={(open) => {
            if (!open) setDialog({ mode: 'closed' });
          }}
          caseId={caseId}
          borrowerId={borrowerId}
          borrowerName={borrowerName}
          income={dialog.mode === 'edit' ? dialog.income : null}
          incomeTypes={incomeTypes}
          locale={locale}
        />
      )}
    </div>
  );
}
