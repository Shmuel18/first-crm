import Link from 'next/link';

import { FileQuestion } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export default async function RootNotFound() {
  const t = await getTranslations('error');

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-brand-surface px-4 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-neutral-100">
        <FileQuestion className="size-8 text-neutral-400" />
      </div>
      <h1 className="font-display text-xl text-neutral-900">{t('notFoundTitle')}</h1>
      <p className="mt-1 mb-5 text-sm text-neutral-500">{t('notFoundDescription')}</p>
      <Link
        href="/"
        className="btn-gold inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm"
      >
        {t('backHome')}
      </Link>
    </div>
  );
}
