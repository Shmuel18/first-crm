import { getTranslations } from 'next-intl/server';

export default async function AppLoading() {
  const t = await getTranslations('common');

  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {t('loading')}
      </span>
      <div className="-mx-6 -mt-6 animate-pulse" aria-hidden>
        <div className="h-16 border-b border-neutral-200 bg-white" />
        <div className="space-y-3 bg-white p-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-neutral-100" />
          ))}
        </div>
      </div>
    </>
  );
}
