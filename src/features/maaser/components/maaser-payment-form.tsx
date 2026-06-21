'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { addMaaserPaymentAction } from '../actions/add-maaser-payment';

type Props = {
  /** Today's date (Israel TZ), computed on the server to avoid a hydration mismatch. */
  defaultDate: string;
};

const fieldClass =
  'h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm shadow-xs outline-none transition focus:border-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/30';

export function MaaserPaymentForm({ defaultDate }: Props) {
  const t = useTranslations('maaser.form');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [paidOn, setPaidOn] = useState(defaultDate);
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');

  const amountNum = Number(amount);
  const canSubmit = paidOn !== '' && Number.isFinite(amountNum) && amountNum > 0 && !pending;

  const submit = () => {
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await addMaaserPaymentAction({
        paidOn,
        amount: amountNum,
        recipient: recipient.trim() || null,
        note: note.trim() || null,
      });
      if (!res.ok) {
        toast.error(t(`errors.${res.error}`));
        return;
      }
      // Keep the date, clear the rest for the next entry; refresh balances.
      setAmount('');
      setRecipient('');
      setNote('');
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-neutral-800">{t('title')}</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[8rem_8rem_1fr_1fr_auto]">
        <input
          type="date"
          value={paidOn}
          onChange={(e) => setPaidOn(e.target.value)}
          aria-label={t('date')}
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
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder={t('recipient')}
          aria-label={t('recipient')}
          maxLength={200}
          className={fieldClass}
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('note')}
          aria-label={t('note')}
          maxLength={500}
          className={fieldClass}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-brand-gold px-4 text-sm font-semibold text-brand-black transition hover:bg-brand-gold-hover disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {t('add')}
        </button>
      </div>
    </div>
  );
}
