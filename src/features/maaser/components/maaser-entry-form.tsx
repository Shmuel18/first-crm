'use client';

import { useState, useTransition } from 'react';

import { Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { DateInputWithPicker } from '@/components/ui/date-input-with-picker';

import { addMaaserEntryAction } from '../actions/add-maaser-entry';
import type { MaaserEntryKind } from '../types';

type Props = {
  /** Today's date (Israel TZ), computed on the server to avoid a hydration mismatch. */
  defaultDate: string;
};

const fieldClass =
  'h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm shadow-xs outline-none transition focus:border-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/30';

export function MaaserEntryForm({ defaultDate }: Props) {
  const t = useTranslations('maaser.entryForm');
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<MaaserEntryKind>('income');
  const [entryDate, setEntryDate] = useState(defaultDate);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const amountNum = Number(amount);
  const canSubmit = entryDate !== '' && Number.isFinite(amountNum) && amountNum > 0 && !pending;

  const submit = () => {
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        const res = await addMaaserEntryAction({
          entryDate,
          kind,
          amount: amountNum,
          description: description.trim() || null,
        });
        if (!res.ok) {
          toast.error(t(`errors.${res.error}`));
          return;
        }
        // Keep the date + kind, clear the rest for the next entry.
        setAmount('');
        setDescription('');
      } catch {
        toast.error(t('errors.unknown'));
      }
    });
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-neutral-800">{t('title')}</h3>

      {/* Income / expense segmented toggle. */}
      <div className="mb-2 inline-flex rounded-lg border border-neutral-200 p-0.5">
        <KindButton active={kind === 'income'} onClick={() => setKind('income')} icon={TrendingUp}>
          {t('income')}
        </KindButton>
        <KindButton active={kind === 'expense'} onClick={() => setKind('expense')} icon={TrendingDown}>
          {t('expense')}
        </KindButton>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[11rem_8rem_1fr_auto]">
        <DateInputWithPicker
          value={entryDate}
          onChange={setEntryDate}
          pickerLabel={t('date')}
          className={fieldClass}
        />
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t('amount')}
          aria-label={t('amount')}
          className={`${fieldClass} tabular-nums`}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('description')}
          aria-label={t('description')}
          maxLength={500}
          className={fieldClass}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-brand-gold px-4 text-sm font-semibold text-brand-black transition hover:bg-brand-gold-hover disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t('add')}
        </button>
      </div>
    </div>
  );
}

function KindButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active ? 'bg-brand-gold-soft text-brand-gold-text' : 'text-neutral-500 hover:text-neutral-800'
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {children}
    </button>
  );
}
