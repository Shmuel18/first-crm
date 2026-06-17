'use client';

import { useState } from 'react';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { GroupedNumberInput } from '@/components/shared/grouped-number-input';
import { CurrencySign } from '@/components/ui/currency-sign';
import { DatePickerPopover } from '@/components/ui/date-picker-popover';
import { Tooltip } from '@/components/ui/tooltip';

import { type EditableExpenseField } from '../actions/update-expense-field';
import { ExpenseReceiptCell } from './expense-receipt-cell';
import type { CaseExpenseRow } from '../types';

type Props = {
  caseId: string;
  expense: CaseExpenseRow;
  canEdit: boolean;
  /** Persist one cell. The parent (CaseExpensesList) owns the optimistic state
   *  + rollback, so the row only reports edits. */
  onSaveField: (field: EditableExpenseField, value: unknown) => void;
  /** Remove the row. The parent deletes optimistically (the row vanishes
   *  immediately), so there is no per-row spinner. */
  onDelete: () => void;
};

/**
 * Single expense row — three inline cells (date / amount / description) +
 * a per-row delete. Same look-and-feel as obligation-table-row so the
 * admin block's two tables (expenses + open tasks) read consistently.
 */
export function CaseExpenseRow({ caseId, expense, canEdit, onSaveField, onDelete }: Props) {
  const tc = useTranslations('common');
  const t = useTranslations('expenses');

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50 transition group">
      <Cell>
        <DateCell
          value={expense.expense_date}
          onSave={(v) => onSaveField('expense_date', v)}
          label={tc('selectDate')}
          disabled={!canEdit}
        />
      </Cell>
      <Cell>
        <NumberCell value={expense.amount} onSave={(v) => onSaveField('amount', v)} disabled={!canEdit} />
      </Cell>
      <Cell>
        <TextCell
          value={expense.description}
          onSave={(v) => onSaveField('description', v)}
          placeholder={t('fields.descriptionPlaceholder')}
          disabled={!canEdit}
        />
      </Cell>
      <td className="px-1 py-1.5 align-middle text-end whitespace-nowrap">
        <span className="inline-flex items-center justify-end">
          <ExpenseReceiptCell
            caseId={caseId}
            expenseId={expense.id}
            canEdit={canEdit}
            initialName={expense.receipt_name}
          />
          {canEdit && (
            <Tooltip content={tc('delete')}>
              <button
                type="button"
                onClick={onDelete}
                aria-label={tc('delete')}
                className="size-7 rounded inline-flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
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
  'w-full h-9 min-w-0 px-2.5 rounded-md border border-neutral-200 bg-white text-sm text-neutral-900 shadow-xs focus:outline-none focus-visible:border-brand-gold-text focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 transition disabled:bg-neutral-50 disabled:text-neutral-500 disabled:shadow-none disabled:cursor-default';

function TextCell({
  value,
  onSave,
  placeholder,
  disabled,
}: {
  value: string | null;
  onSave: (next: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
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
      disabled={disabled}
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
  disabled,
}: {
  value: number | null;
  onSave: (next: number | null) => void;
  disabled?: boolean;
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
      <GroupedNumberInput
        value={local}
        onChange={setLocal}
        onCommit={(raw) => {
          const next = raw === '' ? null : Number(raw);
          if ((next === null && value === null) || next === value) return;
          if (next !== null && !Number.isFinite(next)) {
            setLocal(initial);
            return;
          }
          onSave(next);
        }}
        inputMode="decimal"
        dir="ltr"
        disabled={disabled}
        className={`${baseInputClass} text-end`}
      />
      <CurrencySign />
    </div>
  );
}

function DateCell({
  value,
  onSave,
  label,
  disabled,
}: {
  value: string | null;
  onSave: (next: string | null) => void;
  label: string;
  disabled?: boolean;
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
        disabled={disabled}
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
        disabled={disabled}
      />
    </div>
  );
}
