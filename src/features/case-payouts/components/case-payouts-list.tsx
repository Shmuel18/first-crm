'use client';

import { useState, useTransition } from 'react';

import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { createEmptyPayoutAction } from '../actions/create-empty-payout';
import { deletePayoutAction } from '../actions/delete-payout';
import { updatePayoutFieldAction, type EditablePayoutField } from '../actions/update-payout-field';

import { emptyPayoutRow } from './case-payout-empty-row';
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
 * avoid the heavy case-page re-render). Mirrors CaseExpensesList.
 */
export function CasePayoutsList({ caseId, payouts, canEdit }: Props) {
  const t = useTranslations('payouts');
  const tf = useTranslations('payouts.fields');
  const tc = useTranslations('common');
  const [isAdding, startAdd] = useTransition();

  const [rows, setRows] = useState<CasePayoutRowData[]>(() => [...payouts]);
  const sig = payouts.map((p) => `${p.id}:${p.recipient ?? ''}:${p.amount ?? ''}`).join('|');
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig);
    setRows([...payouts]);
  }

  const handleAdd = () => {
    if (!canEdit) return;
    const tempId = `optimistic-${prevSig.length}-${rows.length}`;
    setRows((prev) => [...prev, emptyPayoutRow(tempId, caseId)]);
    startAdd(async () => {
      const result = await createEmptyPayoutAction(caseId);
      if (!result.ok) {
        setRows((prev) => prev.filter((r) => r.id !== tempId));
        toast.error(tc('saveFailed'));
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === tempId ? { ...r, id: result.payoutId } : r)));
    });
  };

  const handleDelete = (id: string) => {
    const index = rows.findIndex((r) => r.id === id);
    const removed = rows[index];
    if (!removed) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    void deletePayoutAction(id, caseId).then((result) => {
      if (result.ok) return;
      setRows((prev) => {
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, removed);
        return next;
      });
      toast.error(tc('saveFailed'));
    });
  };

  const saveField = async (id: string, field: EditablePayoutField, value: unknown) => {
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    const prev = target[field];
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, [field]: value as never } : r)));
    const result = await updatePayoutFieldAction(id, caseId, field, value);
    if (!result.ok) {
      setRows((cur) => cur.map((r) => (r.id === id ? { ...r, [field]: prev as never } : r)));
    }
  };

  const addButton = canEdit ? (
    <button
      type="button"
      onClick={handleAdd}
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
                key={p.id}
                payout={p}
                canEdit={canEdit}
                onSaveField={(field, value) => saveField(p.id, field, value)}
                onDelete={() => handleDelete(p.id)}
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
