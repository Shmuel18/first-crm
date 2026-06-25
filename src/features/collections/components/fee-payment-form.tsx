'use client';

import { useState, useTransition } from 'react';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { DateInputWithPicker } from '@/components/ui/date-input-with-picker';

import { addFeePaymentAction } from '../actions/add-fee-payment';
import { PAYMENT_METHODS } from '../domain/payment-methods';
import type { FeePayment } from '../types';

type Props = {
  caseId: string;
  /** Today's date (Israel TZ), computed on the server to avoid a hydration mismatch. */
  defaultDate: string;
  /** Fired with the saved payment so the parent can update its list optimistically
   *  (the case block) or close itself (the dashboard dialog ignores the arg). */
  onAdded?: (payment: FeePayment) => void;
};

const fieldClass =
  'h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm shadow-xs outline-none transition focus:border-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/30';

export function FeePaymentForm({ caseId, defaultDate, onAdded }: Props) {
  const t = useTranslations('collections.form');
  const tMethod = useTranslations('collections.method');
  const [pending, startTransition] = useTransition();
  const [paidOn, setPaidOn] = useState(defaultDate);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');

  const amountNum = Number(amount);
  const canSubmit = Number.isFinite(amountNum) && amountNum > 0 && !pending;

  const submit = () => {
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        const paymentMethod = method ? (method as (typeof PAYMENT_METHODS)[number]) : null;
        const res = await addFeePaymentAction({
          caseId,
          paidOn: paidOn || null,
          amount: amountNum,
          paymentMethod,
          label: label.trim() || null,
          note: note.trim() || null,
        });
        if (!res.ok) {
          toast.error(t(`errors.${res.error}`));
          return;
        }
        onAdded?.({
          id: res.id,
          caseId,
          paidOn: paidOn || null,
          amount: amountNum,
          paymentMethod,
          label: label.trim() || null,
          note: note.trim() || null,
        });
        // Keep the date, clear the rest for the next entry.
        setAmount('');
        setMethod('');
        setLabel('');
        setNote('');
      } catch {
        toast.error(t('errors.unknown'));
      }
    });
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-neutral-800">{t('title')}</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[10rem_7rem_9rem_1fr_auto]">
        <DateInputWithPicker
          value={paidOn}
          onChange={setPaidOn}
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
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          aria-label={t('method')}
          className={fieldClass}
        >
          <option value="">{t('methodPlaceholder')}</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {tMethod(m)}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('label')}
          aria-label={t('label')}
          maxLength={120}
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
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t('note')}
        aria-label={t('note')}
        maxLength={500}
        className={`${fieldClass} mt-2`}
      />
    </div>
  );
}
