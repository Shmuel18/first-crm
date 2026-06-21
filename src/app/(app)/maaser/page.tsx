import { redirect } from 'next/navigation';

import { HandCoins } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { MaaserView } from '@/features/maaser/components/maaser-view';
import { pickDailyQuote } from '@/features/maaser/domain/quotes';
import { getMaaserBasis, listMaaserPayments } from '@/features/maaser/services/maaser.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';

export default async function MaaserPage() {
  // Manager-only — the owner's personal charity ledger. RLS + the statistics
  // RPC's is_admin() gate enforce this server-side; this is the user-facing guard.
  if (!(await isCurrentUserAdmin())) redirect('/cases');

  const [basis, payments, t] = await Promise.all([
    getMaaserBasis(),
    listMaaserPayments(),
    getTranslations('maaser'),
  ]);
  const locale = parseLocale(await getLocale());
  // Default donation date = today in Israel time, computed server-side so the
  // date input doesn't hydrate-mismatch near midnight.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
  const quote = pickDailyQuote(today);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-gold-soft px-3 py-1 text-sm font-medium text-brand-gold-text">
          <HandCoins className="size-4" aria-hidden="true" />
          {t('eyebrow')}
        </div>
        <h1 className="font-display text-3xl font-semibold text-neutral-950">{t('title')}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t('subtitle')}</p>
        {/* Quote of the day — Chazal on ma'aser/tzedaka, rotates daily. */}
        <figure className="mt-3 border-s-2 border-brand-gold/40 ps-3">
          <blockquote className="font-display text-lg leading-relaxed text-brand-gold-text">{quote.text}</blockquote>
          <figcaption className="mt-0.5 text-xs text-neutral-400">{quote.source}</figcaption>
        </figure>
      </header>
      <MaaserView basis={basis} payments={payments} defaultDate={today} locale={locale} />
    </div>
  );
}
