import Image from 'next/image';

import { getTranslations } from 'next-intl/server';

export default async function AppLoading() {
  const t = await getTranslations('common');

  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {t('loading')}
      </span>
      <div className="-mx-6 -mt-6" aria-hidden>
        <div className="h-16 border-b border-neutral-200 bg-white" />
        <div className="relative bg-white p-6">
          {/* Brand logo gently pulsing — the focal point of the wait. */}
          <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center">
            <Image
              src="/logo-mark.png"
              alt=""
              width={1152}
              height={740}
              className="h-12 w-auto animate-pulse opacity-90"
            />
          </div>
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
