import { useLocale, useTranslations } from 'next-intl';

import type { Locale } from '@/lib/i18n/direction';

import { getGreetingKey } from '../domain/greeting';

type Props = {
  firstName: string;
};

export function DashboardWelcomeBanner({ firstName }: Props) {
  const t = useTranslations('dashboard');
  const locale = useLocale() as Locale;
  const greetingKey = getGreetingKey();

  return (
    <div className="bg-gradient-to-l from-[#FAFAFA] via-white to-[#FAFAFA] px-6 py-2.5 border-b border-neutral-200">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="font-display text-xl text-neutral-900 leading-tight">
          {t(`greetings.${greetingKey}`)}
          {firstName && (
            <>
              , <span className="text-[#C9A961]">{firstName}</span>
            </>
          )}
        </h1>
        <div className="text-xs text-neutral-400">
          {new Date().toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </div>
    </div>
  );
}
