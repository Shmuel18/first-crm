import { cookies } from 'next/headers';

import { getRequestConfig } from 'next-intl/server';

import { brandizeMessages } from '@/lib/i18n/brandize';
import { SUPPORTED_LOCALES, parseLocale } from '@/lib/i18n/direction';

const LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * Server-side locale resolution.
 *
 * Priority:
 * 1. A locale the CALLER asked for explicitly — `getTranslations({ locale })`.
 * 2. Cookie set by the user's last preference (set when they change locale)
 * 3. Default ('he')
 *
 * (1) is load-bearing and used to be missing: this config read the cookie
 * unconditionally, so every `getTranslations({ locale: 'en' })` — the client
 * emails, the invite/reset mail, the export routes, the signing page — got the
 * VIEWER's language instead of the requested one. An advisor composing an
 * English message to a client still got a Hebrew branded shell, and an English
 * agreement rendered Hebrew buttons. Page rendering passes no locale, so it
 * keeps following the cookie exactly as before.
 *
 * For an internal admin app we keep URLs clean (no /he/ /en/ prefix).
 * Locale is server-rendered via this config.
 */
export default getRequestConfig(async ({ locale: requestedLocale }) => {
  const explicit =
    typeof requestedLocale === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(requestedLocale)
      ? requestedLocale
      : null;

  const locale = explicit
    ? parseLocale(explicit)
    : parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);

  const messages = (await import(`../../messages/${locale}.json`)).default;

  // White-label: substitute the active office's name into the catalog.
  return { locale, messages: brandizeMessages(messages) };
});
