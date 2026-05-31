import { getTranslations } from 'next-intl/server';

import { LoadingLogo } from '@/components/shared/loading-logo';

export default async function SettingsLoading() {
  const t = await getTranslations('common');

  return (
    <div className="relative -mt-6">
      <span role="status" aria-live="polite" className="sr-only">
        {t('loading')}
      </span>
      <LoadingLogo />

      <div
        className="bg-brand-gold-soft sticky top-[-1rem] sm:top-[-1.5rem] z-20 shadow-sm -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 border-b border-brand-gold/20"
        aria-hidden
      >
        <div className="h-4 w-40 rounded bg-brand-gold/20" />
        <div className="mt-1.5 h-3 w-56 rounded bg-neutral-200" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 mt-6 animate-pulse" aria-hidden>
        <aside className="space-y-6">
          {Array.from({ length: 3 }).map((_, section) => (
            <div key={section} className="space-y-1">
              <div className="mx-3 mb-1.5 h-3 w-20 rounded bg-neutral-200" />
              {Array.from({ length: 3 }).map((_, item) => (
                <div key={item} className="h-9 rounded-lg bg-neutral-100" />
              ))}
            </div>
          ))}
        </aside>

        <main className="space-y-4">
          <div className="h-32 rounded-xl bg-neutral-100" />
          <div className="h-48 rounded-xl bg-neutral-100" />
        </main>
      </div>
    </div>
  );
}
