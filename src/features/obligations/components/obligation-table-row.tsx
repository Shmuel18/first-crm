'use client';

import { useState } from 'react';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { GroupedNumberInput } from '@/components/shared/grouped-number-input';
import { CurrencySign } from '@/components/ui/currency-sign';
import { DatePickerPopover } from '@/components/ui/date-picker-popover';
import { Tooltip } from '@/components/ui/tooltip';

import { type EditableObligationField } from '../actions/update-obligation-field';
import type { ObligationRow as ObligationRowData } from '../types';

type Props = {
  obligation: ObligationRowData;
  canEdit: boolean;
  /** Persist one cell. The parent (CaseObligationsClient) owns the optimistic
   *  state + rollback + the end_date→months smart default, so the row only
   *  reports edits. */
  onSaveField: (field: EditableObligationField, value: unknown) => void;
  /** Remove the row. The parent deletes optimistically (the row vanishes
   *  immediately), so there is no per-row spinner. */
  onDelete: () => void;
};

/**
 * Single obligation rendered as a table row. Inline-editable cells (no dialog,
 * no expand/collapse) — each cell saves on blur via the parent's onSaveField.
 * Column order: loan balance · monthly payment · end date · months left · lender.
 */
export function ObligationTableRow({ obligation, canEdit, onSaveField, onDelete }: Props) {
  const t = useTranslations('obligations');
  const tc = useTranslations('common');

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50 transition group">
      <Cell>
        <NumberCell value={obligation.loan_amount} onSave={(v) => onSaveField('loan_amount', v)} disabled={!canEdit} />
      </Cell>
      <Cell>
        <NumberCell
          value={obligation.monthly_payment}
          onSave={(v) => onSaveField('monthly_payment', v)}
          disabled={!canEdit}
        />
      </Cell>
      <Cell>
        <DateCell
          value={obligation.end_date}
          onSave={(v) => onSaveField('end_date', v)}
          label={tc('selectDate')}
          disabled={!canEdit}
        />
      </Cell>
      <Cell>
        <NumberCell
          value={obligation.months_remaining}
          onSave={(v) => onSaveField('months_remaining', v)}
          integer
          disabled={!canEdit}
        />
      </Cell>
      <Cell>
        <TextCell
          value={obligation.lender}
          onSave={(v) => onSaveField('lender', v)}
          placeholder={t('unnamedLender')}
          disabled={!canEdit}
        />
      </Cell>
      <td className="w-9 px-1 py-1.5 align-middle">
        {canEdit && (
          <Tooltip content={tc('delete')}>
            <button
              type="button"
              onClick={onDelete}
              aria-label={tc('delete')}
              className="size-7 rounded inline-flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 transition tap-target opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          </Tooltip>
        )}
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
  integer,
  disabled,
}: {
  value: number | null;
  onSave: (next: number | null) => void;
  integer?: boolean;
  disabled?: boolean;
}) {
  const initial = value === null || value === undefined ? '' : String(value);
  const [local, setLocal] = useState(initial);
  const [propRef, setPropRef] = useState(initial);
  if (initial !== propRef) {
    setPropRef(initial);
    setLocal(initial);
  }
  // Non-integer NumberCells in this table are all money columns
  // (loan_amount, monthly_payment) — show ₪ next to the input.
  const isMoney = !integer;
  return (
    <div className="flex items-center gap-1 min-w-0">
      {isMoney ? (
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
      ) : (
        <input
          type="number"
          inputMode="numeric"
          step={1}
          value={local}
          dir="ltr"
          disabled={disabled}
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
      )}
      {isMoney && <CurrencySign />}
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
