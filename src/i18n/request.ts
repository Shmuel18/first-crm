import { cookies } from 'next/headers';

import { getRequestConfig } from 'next-intl/server';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/direction';

const LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * Server-side locale resolution.
 *
 * Priority:
 * 1. Cookie set by the user's last preference (set when they change locale)
 * 2. Default ('he')
 *
 * For an internal admin app we keep URLs clean (no /he/ /en/ prefix).
 * Locale is server-rendered via this config.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value as Locale | undefined;
  const locale: Locale =
    cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale)
      ? cookieLocale
      : DEFAULT_LOCALE;

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return { locale, messages };
});
