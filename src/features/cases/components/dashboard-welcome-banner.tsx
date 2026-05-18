import { useLocale, useTranslations } from 'next-intl';

import type { Locale } from '@/lib/i18n/direction';

import { getGreetingKey, getInsight } from '../domain/greeting';

type Props = {
  firstName: string;
  casesCount: number;
  stuckCount: number;
};

export function DashboardWelcomeBanner({ firstName, casesCount, stuckCount }: Props) {
  const t = useTranslations('dashboard');
  const locale = useLocale() as Locale;
  const greetingKey = getGreetingKey();
  const insight = getInsight(casesCount, stuckCount);

  return (
    <div className="bg-gradient-to-l from-[#FAFAFA] via-white to-[#FAFAFA] px-6 py-5 border-b border-neutral-200">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-neutral-900 leading-tight">
            {t(`greetings.${greetingKey}`)}
            {firstName && (
              <>
                , <span className="text-[#C9A961]">{firstName}</span>
              </>
            )}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">{renderInsight(t, insight)}</p>
        </div>
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

function renderInsight(
  t: ReturnType<typeof useTranslations>,
  insight: ReturnType<typeof getInsight>,
): string {
  switch (insight.kind) {
    case 'empty':
      return t('insights.empty');
    case 'stuckSingle':
      return t('insights.stuckSingle');
    case 'stuckMany':
      return t('insights.stuckMany', { count: insight.count });
    case 'casesSingle':
      return t('insights.casesSingle');
    case 'casesMany':
      return t('insights.casesMany', { count: insight.count });
  }
}
