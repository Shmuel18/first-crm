'use client';

import { CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
    </div>
  );
}
