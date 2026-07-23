'use client';

import { useState } from 'react';

import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatCurrency } from '@/lib/utils/format-currency';
import type { Locale } from '@/lib/i18n/direction';

import { computeMaaserSummary, sumAmounts } from '../domain/calc';
import type { MaaserBasis } from '../services/maaser.service';
import type { MaaserEntry, MaaserPayment } from '../types';
import { MaaserBasisCards } from './maaser-basis-cards';
import { MaaserEntriesTable } from './maaser-entries-table';
import { MaaserEntryForm } from './maaser-entry-form';
import { MaaserPaymentForm } from './maaser-payment-form';
import { MaaserPaymentsTable } from './maaser-payments-table';

type Props = {
  basis: MaaserBasis;
  entries: MaaserEntry[];
  payments: MaaserPayment[];
  defaultDate: string;
  locale: Locale;
};

// Visual redaction only — figures are still in the page payload (the manager is
// authorized). Hidden by default, like the statistics financial summary, so the
// numbers aren't on screen the moment the page loads.
const MASK = '••••••';

export function MaaserView({ basis, entries, payments, defaultDate, locale }: Props) {
  const t = useTranslations('maaser');
  const [revealed, setRevealed] = useState(false);

  const manualIncome = sumAmounts(entries.filter((e) => e.kind === 'income').map((e) => e.amount));
  const manualExpenses = sumAmounts(entries.filter((e) => e.kind === 'expense').map((e) => e.amount));
  const totalGiven = sumAmounts(payments.map((p) => p.amount));
  const s = computeMaaserSummary(
    {
      feeCollected: basis.feeCollected,
      commissions: basis.commissions,
      manualIncome,
      manualExpenses,
    },
    totalGiven,
  );

  const show = (v: number): string => (revealed ? formatCurrency(v, locale) : MASK);
  const RevealIcon = revealed ? EyeOff : Eye;
  const toggleLabel = revealed ? t('hide') : t('reveal');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-pressed={revealed}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-neutral-600 transition hover:bg-brand-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
        >
          <RevealIcon className="size-4" aria-hidden="true" />
          <span>{toggleLabel}</span>
        </button>
      </div>

      <MaaserBasisCards s={s} show={show} />

      {/* Given + remaining */}
      <section className="rounded-xl border border-neutral-200 bg-brand-gold-soft p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-neutral-950">{t('balance.title')}</h2>
          <div className="text-sm text-neutral-600">
            {t('balance.totalGiven')}:{' '}
            <span className="font-semibold text-neutral-900 tabular-nums">{show(s.totalGiven)}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Balance label={t('balance.maaser')} due={show(s.maaserDue)} remaining={s.maaserRemaining} pct={revealed ? s.maaserPct : 0} show={show} revealed={revealed} t={t} />
          <Balance label={t('balance.chomesh')} due={show(s.chomeshDue)} remaining={s.chomeshRemaining} pct={revealed ? s.chomeshPct : 0} show={show} revealed={revealed} t={t} />
        </div>
      </section>

      {/* Manual income / expense ledger */}
      <section className="space-y-2">
        <MaaserEntryForm defaultDate={defaultDate} />
        <h2 className="font-display text-lg font-semibold text-neutral-950">{t('entriesLedger')}</h2>
        <MaaserEntriesTable entries={entries} locale={locale} revealed={revealed} mask={MASK} />
      </section>

      {/* Donations */}
      <section className="space-y-2">
        <MaaserPaymentForm defaultDate={defaultDate} />
        <h2 className="font-display text-lg font-semibold text-neutral-950">{t('ledger')}</h2>
        <MaaserPaymentsTable payments={payments} locale={locale} revealed={revealed} mask={MASK} />
      </section>
    </div>
  );
}

function Balance({
  label,
  due,
  remaining,
  pct,
  show,
  revealed,
  t,
}: {
  label: string;
  due: string;
  remaining: number;
  pct: number;
  show: (v: number) => string;
  revealed: boolean;
  t: ReturnType<typeof useTranslations<'maaser'>>;
}) {
  const met = remaining <= 0;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-neutral-800">{label}</span>
        <span className="text-xs text-neutral-500">{due}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full rounded-full ${met ? 'bg-emerald-500' : 'bg-brand-gold'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`mt-2 text-sm font-semibold tabular-nums ${met ? 'text-emerald-600' : 'text-brand-gold-text'}`}>
        {!revealed
          ? show(0)
          : met
            ? t('balance.fulfilled', { amount: show(Math.abs(remaining)) })
            : t('balance.remaining', { amount: show(remaining) })}
      </div>
    </div>
  );
}
