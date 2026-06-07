'use client';

import Image from 'next/image';

import { useLocale, useTranslations } from 'next-intl';

import { switchLocaleAction } from '@/features/auth/actions/switch-locale';
import { cn } from '@/lib/utils';

const LOCALES = ['he', 'en'] as const;

export function IntakeHeader() {
  const t = useTranslations('intake');
  const locale = useLocale();

  // Reuse the app's canonical switcher: it sets the NEXT_LOCALE cookie and
  // revalidates the layout. Its profiles mirror is a no-op for anon visitors.
  const switchTo = (next: (typeof LOCALES)[number]) => {
    if (next === locale) return;
    void switchLocaleAction(next);
  };

  return (
    <header className="relative bg-brand-black px-6 py-8 text-center">
      <div className="absolute top-5 end-5 flex overflow-hidden rounded-lg border border-neutral-700 text-xs font-semibold">
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => switchTo(l)}
            className={cn(
              'px-3 py-1.5 transition-colors',
              locale === l
                ? 'bg-brand-gold text-brand-black'
                : 'text-neutral-400 hover:text-white',
            )}
          >
            {t(`options.language.${l}`)}
          </button>
        ))}
      </div>

      <div className="mx-auto mb-3 flex justify-center">
        <div className="relative h-16 w-[200px]">
          <Image
            src="/logo.png"
            alt="Kaufman Finance Group"
            fill
            priority
            sizes="200px"
            className="object-contain"
          />
        </div>
      </div>
      <h1 className="font-display text-2xl font-bold text-white">{t('title')}</h1>
      <p className="mt-1 text-sm text-neutral-400">{t('subtitle')}</p>
    </header>
  );
}
