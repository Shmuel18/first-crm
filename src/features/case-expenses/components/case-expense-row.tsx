'use client';

import { useState, useTransition } from 'react';

import { Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { CurrencySign } from '@/components/ui/currency-sign';
import { DatePickerPopover } from '@/components/ui/date-picker-popover';
import { Tooltip } from '@/components/ui/tooltip';

import { deleteExpenseAction } from '../actions/delete-expense';
import {
  updateExpenseFieldAction,
  type EditableExpenseField,
} from '../actions/update-expense-field';
import { ExpenseReceiptCell } from './expense-receipt-cell';
import type { CaseExpenseRow } from '../types';

type Props = {
  caseId: string;
  expense: CaseExpenseRow;
  canEdit: boolean;
};

/**
 * Single expense row — three inline cells (date / amount / description) +
 * a per-row delete. Same look-and-feel as obligation-table-row so the
 * admin block's two tables (expenses + open tasks) read consistently.
 */
export function CaseExpenseRow({ caseId, expense, canEdit }: Props) {
  const tc = useTranslations('common');
  const t = useTranslations('expenses');
  const [row, setRow] = useState(expense);
  const [isDeleting, startDelete] = useTransition();

  // Resync from server after revalidation.
  const [propRef, setPropRef] = useState(expense);
  if (expense !== propRef) {
    setPropRef(expense);
    setRow(expense);
  }

  const saveField = async (field: EditableExpenseField, value: unknown) => {
    const prev = row[field];
    setRow((r) => ({ ...r, [field]: value as never }));
    const result = await updateExpenseFieldAction(expense.id, caseId, field, value);
    if (!result.ok) {
      setRow((r) => ({ ...r, [field]: prev as never }));
    }
  };

  const handleDelete = () => {
    startDelete(async () => {
      const result = await deleteExpenseAction(expense.id, caseId);
      if (result.ok) toast.success(t('deleteSuccess'));
      else toast.error(t('deleteError'));
    });
  };

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50 transition group">
      <Cell>
        <DateCell
          value={row.expense_date}
          onSave={(v) => saveField('expense_date', v)}
          label={tc('selectDate')}
        />
      </Cell>
      <Cell>
        <NumberCell
          value={row.amount}
          onSave={(v) => saveField('amount', v)}
        />
      </Cell>
      <Cell>
        <TextCell
          value={row.description}
          onSave={(v) => saveField('description', v)}
          placeholder={t('fields.descriptionPlaceholder')}
        />
      </Cell>
      <td className="px-1 py-1.5 align-middle text-end whitespace-nowrap">
        <span className="inline-flex items-center justify-end">
          <ExpenseReceiptCell
            caseId={caseId}
            expenseId={row.id}
            canEdit={canEdit}
            initialName={row.receipt_name}
          />
          {canEdit && (
            <Tooltip content={tc('delete')}>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                aria-label={tc('delete')}
                className="size-7 rounded inline-flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-3.5" aria-hidden="true" />
                )}
              </button>
            </Tooltip>
          )}
        </span>
      </td>
    </tr>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-1.5 py-1.5 align-middle">{children}</td>;
}

const baseInputClass =
  'w-full h-9 min-w-0 px-2.5 rounded-md border border-neutral-200 bg-white text-sm text-neutral-900 shadow-xs focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 transition';

function TextCell({
  value,
  onSave,
  placeholder,
}: {
  value: string | null;
  onSave: (next: string | null) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value ?? '');
  const [propRef, setPropRef] = useState(value ?? '');
  if ((value ?? '') !== propRef) {
    setPropRef(value ?? '');
    setLocal(value ?? '');
  }
  return (
    <input
      type="text"
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={(e) => {
        const next = e.target.value.trim();
        if (next === (value ?? '').trim()) return;
        onSave(next === '' ? null : next);
      }}
      className={baseInputClass}
    />
  );
}

function NumberCell({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (next: number | null) => void;
}) {
  const initial = value === null || value === undefined ? '' : String(value);
  const [local, setLocal] = useState(initial);
  const [propRef, setPropRef] = useState(initial);
  if (initial !== propRef) {
    setPropRef(initial);
    setLocal(initial);
  }
  // The only NumberCell in the expenses table is the amount column — always
  // money, so the ₪ adornment goes here unconditionally.
  return (
    <div className="flex items-center gap-1 min-w-0">
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={local}
        dir="ltr"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => {
          const raw = e.target.value.trim();
          const next = raw === '' ? null : Number(raw);
          if ((next === null && value === null) || next === value) return;
          if (next !== null && !Number.isFinite(next)) {
            setLocal(initial);
            return;
          }
          onSave(next);
        }}
        className={`${baseInputClass} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield] text-end`}
      />
      <CurrencySign />
    </div>
  );
}

function DateCell({
  value,
  onSave,
  label,
}: {
  value: string | null;
  onSave: (next: string | null) => void;
  label: string;
}) {
  const [local, setLocal] = useState(value ?? '');
  const [propRef, setPropRef] = useState(value ?? '');
  if ((value ?? '') !== propRef) {
    setPropRef(value ?? '');
    setLocal(value ?? '');
  }
  return (
    <div className="flex items-center gap-1 min-w-0">
      <input
        type="date"
        value={local}
        dir="ltr"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => {
          const next = e.target.value || null;
          if (next === value) return;
          onSave(next);
        }}
        className={`${baseInputClass} [&::-webkit-calendar-picker-indicator]:hidden`}
      />
      <DatePickerPopover
        value={local || null}
        onSelect={(next) => {
          setLocal(next ?? '');
          onSave(next);
        }}
        label={label}
      />
    </div>
  );
}
