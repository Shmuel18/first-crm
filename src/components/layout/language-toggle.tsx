'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';

import { switchLocaleAction } from '@/features/auth/actions/switch-locale';

import type { Locale } from '@/lib/i18n/direction';

export function LanguageToggle() {
  const currentLocale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  const switchTo = (locale: Locale) => {
    if (locale === currentLocale || isPending) return;
    startTransition(() => switchLocaleAction(locale));
  };

  return (
    <div className="flex bg-[#1A1A1A] border border-[#333] rounded-lg overflow-hidden text-xs font-semibold">
      <LocaleButton
        label="HE"
        locale="he"
        active={currentLocale === 'he'}
        onClick={() => switchTo('he')}
      />
      <LocaleButton
        label="EN"
        locale="en"
        active={currentLocale === 'en'}
        onClick={() => switchTo('en')}
      />
    </div>
  );
}

function LocaleButton({
  label,
  locale,
  active,
  onClick,
}: {
  label: string;
  locale: Locale;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Switch to ${locale}`}
      aria-pressed={active}
      className={[
        'px-3 py-2 transition',
        active
          ? 'bg-[#C9A961] text-black'
          : 'text-neutral-500 hover:text-white cursor-pointer',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
