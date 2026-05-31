import { getTranslations } from 'next-intl/server';

import { LoadingLogo } from '@/components/shared/loading-logo';

export default async function AppLoading() {
  const t = await getTranslations('common');

  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {t('loading')}
      </span>
      <div className="relative -mx-6 -mt-6" aria-hidden>
        <LoadingLogo />
        <div className="h-16 border-b border-neutral-200 bg-white" />
        <div className="bg-white p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-neutral-100" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
