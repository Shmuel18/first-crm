import { Coins, Gift, HandCoins, Wallet } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { formatCurrency } from '@/lib/utils/format-currency';
import type { Locale } from '@/lib/i18n/direction';

import { computeMaaserSummary, sumGiven } from '../domain/calc';
import type { MaaserBasis } from '../services/maaser.service';
import type { MaaserPayment } from '../types';
import { MaaserPaymentForm } from './maaser-payment-form';
import { MaaserPaymentsTable } from './maaser-payments-table';

type Props = {
  basis: MaaserBasis;
  payments: MaaserPayment[];
  defaultDate: string;
  locale: Locale;
};

export async function MaaserView({ basis, payments, defaultDate, locale }: Props) {
  const t = await getTranslations('maaser');
  const s = computeMaaserSummary(basis.grossFee, basis.netFee, sumGiven(payments.map((p) => p.amount)));
  const fmt = (v: number): string => formatCurrency(v, locale);

  return (
    <div className="space-y-5">
      {/* Basis + obligations */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('basis.gross')} value={fmt(s.grossFee)} icon={Coins} />
        <StatCard label={t('basis.net')} value={fmt(s.netFee)} icon={Wallet} />
        <StatCard label={t('basis.maaserDue')} value={fmt(s.maaserDue)} icon={HandCoins} accent />
        <StatCard label={t('basis.chomeshDue')} value={fmt(s.chomeshDue)} icon={Gift} accent />
      </div>

      {/* Given + remaining */}
      <section className="rounded-xl border border-neutral-200 bg-brand-gold-soft p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-neutral-950">{t('balance.title')}</h2>
          <div className="text-sm text-neutral-600">
            {t('balance.totalGiven')}: <span className="font-semibold text-neutral-900 tabular-nums">{fmt(s.totalGiven)}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Balance label={t('balance.maaser')} due={fmt(s.maaserDue)} remaining={s.maaserRemaining} pct={s.maaserPct} fmt={fmt} t={t} />
          <Balance label={t('balance.chomesh')} due={fmt(s.chomeshDue)} remaining={s.chomeshRemaining} pct={s.chomeshPct} fmt={fmt} t={t} />
        </div>
      </section>

      <MaaserPaymentForm defaultDate={defaultDate} />

      <div>
        <h2 className="mb-2 font-display text-lg font-semibold text-neutral-950">{t('ledger')}</h2>
        <MaaserPaymentsTable payments={payments} locale={locale} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? 'border-brand-gold/40 bg-brand-gold-soft' : 'border-neutral-200 bg-white'}`}>
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        <Icon className="size-3.5 text-brand-gold-text" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate font-display text-xl font-semibold text-neutral-950 tabular-nums">{value}</div>
    </div>
  );
}

function Balance({
  label,
  due,
  remaining,
  pct,
  fmt,
  t,
}: {
  label: string;
  due: string;
  remaining: number;
  pct: number;
  fmt: (v: number) => string;
  t: Awaited<ReturnType<typeof getTranslations<'maaser'>>>;
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
        {met
          ? t('balance.fulfilled', { amount: fmt(Math.abs(remaining)) })
          : t('balance.remaining', { amount: fmt(remaining) })}
      </div>
    </div>
  );
}
