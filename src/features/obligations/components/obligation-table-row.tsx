'use client';

import { useState, useTransition } from 'react';

import { Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { DatePickerPopover } from '@/components/ui/date-picker-popover';
import { Tooltip } from '@/components/ui/tooltip';

import { deleteObligationAction } from '../actions/delete-obligation';
import {
  updateObligationFieldAction,
  type EditableObligationField,
} from '../actions/update-obligation-field';
import type { ObligationRow as ObligationRowData } from '../types';

type Props = {
  caseId: string;
  obligation: ObligationRowData;
  canEdit: boolean;
};

/**
 * Single obligation rendered as a table row. Inline-editable cells (no
 * dialog, no expand/collapse) — each cell saves on blur via the shared
 * updateObligationFieldAction. Column order matches the requested layout:
 * loan balance · monthly payment · end date · months left · lender.
 */
export function ObligationTableRow({ caseId, obligation, canEdit }: Props) {
  const t = useTranslations('obligations');
  const tc = useTranslations('common');
  const [row, setRow] = useState(obligation);
  const [isDeleting, startDelete] = useTransition();

  // Resync from server after revalidation.
  const [propRef, setPropRef] = useState(obligation);
  if (obligation !== propRef) {
    setPropRef(obligation);
    setRow(obligation);
  }

  const saveField = async (field: EditableObligationField, value: unknown) => {
    const prev = row[field];
    setRow((r) => ({ ...r, [field]: value as never }));
    const result = await updateObligationFieldAction(obligation.id, caseId, field, value);
    if (!result.ok) {
      setRow((r) => ({ ...r, [field]: prev as never }));
    }
  };

  const handleDelete = () => {
    startDelete(async () => {
      const result = await deleteObligationAction(obligation.id, obligation.borrower_id, caseId);
      if (result.ok) toast.success(t('deleteSuccess'));
      else toast.error(t('deleteError'));
    });
  };

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50 transition group">
      <Cell>
        <NumberCell
          value={row.loan_amount}
          onSave={(v) => saveField('loan_amount', v)}
        />
      </Cell>
      <Cell>
        <NumberCell
          value={row.monthly_payment}
          onSave={(v) => saveField('monthly_payment', v)}
        />
      </Cell>
      <Cell>
        <DateCell
          value={row.end_date}
          onSave={(v) => saveField('end_date', v)}
          label={tc('selectDate')}
        />
      </Cell>
      <Cell>
        <NumberCell
          value={row.months_remaining}
          onSave={(v) => saveField('months_remaining', v)}
          integer
        />
      </Cell>
      <Cell>
        <TextCell
          value={row.lender}
          onSave={(v) => saveField('lender', v)}
          placeholder={t('unnamedLender')}
        />
      </Cell>
      <td className="w-9 px-1 py-1.5 align-middle">
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
  integer,
}: {
  value: number | null;
  onSave: (next: number | null) => void;
  integer?: boolean;
}) {
  const initial = value === null || value === undefined ? '' : String(value);
  const [local, setLocal] = useState(initial);
  const [propRef, setPropRef] = useState(initial);
  if (initial !== propRef) {
    setPropRef(initial);
    setLocal(initial);
  }
  return (
    <input
      type="number"
      inputMode={integer ? 'numeric' : 'decimal'}
      step={integer ? 1 : 'any'}
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
