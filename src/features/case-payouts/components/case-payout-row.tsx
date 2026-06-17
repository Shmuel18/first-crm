'use client';

import { useState } from 'react';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { GroupedNumberInput } from '@/components/shared/grouped-number-input';
import { CurrencySign } from '@/components/ui/currency-sign';
import { Tooltip } from '@/components/ui/tooltip';

import { type EditablePayoutField } from '../actions/update-payout-field';

import type { CasePayoutRow } from '../types';

type Props = {
  payout: CasePayoutRow;
  canEdit: boolean;
  onSaveField: (field: EditablePayoutField, value: unknown) => void;
  onDelete: () => void;
};

/** Single payout row — recipient + amount inline cells + per-row delete.
 *  Mirrors CaseExpenseRow (manager-only commissions/salaries). */
export function CasePayoutRow({ payout, canEdit, onSaveField, onDelete }: Props) {
  const tc = useTranslations('common');
  const t = useTranslations('payouts');

  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50 transition group">
      <Cell>
        <TextCell
          value={payout.recipient}
          onSave={(v) => onSaveField('recipient', v)}
          placeholder={t('fields.recipientPlaceholder')}
        />
      </Cell>
      <Cell>
        <NumberCell value={payout.amount} onSave={(v) => onSaveField('amount', v)} />
      </Cell>
      <td className="px-1 py-1.5 align-middle text-end whitespace-nowrap">
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
        className={`${baseInputClass} text-end`}
      />
      <CurrencySign />
    </div>
  );
}
