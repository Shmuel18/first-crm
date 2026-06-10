'use client';

import { CircleCheck, House } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { WEBSITE_URL } from '../../constants';

export function StepSuccess() {
  const t = useTranslations('intake.success');

  return (
    <div className="rounded-2xl border border-neutral-100 bg-white px-6 py-12 text-center shadow-sm">
      <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-emerald-50">
        <CircleCheck className="size-9 text-emerald-500" />
      </div>
      <h1 className="font-display text-2xl font-bold text-neutral-900">{t('title')}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">{t('body')}</p>
      <p className="mt-4 text-xs text-neutral-500">{t('contact')}</p>
      <a
        href={WEBSITE_URL}
        className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-brand-gold-dark bg-white px-5 text-sm font-bold text-brand-black transition-colors hover:bg-brand-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2"
      >
        <House className="size-4" aria-hidden="true" />
        {t('backToWebsite')}
      </a>
    </div>
  );
}
