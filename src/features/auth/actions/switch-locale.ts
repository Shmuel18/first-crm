'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { env } from '@/lib/env';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/direction';

const LOCALE_COOKIE = 'NEXT_LOCALE';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Updates the user's preferred UI locale.
 * Persisted in a cookie (and would update profiles.language in a follow-up).
 *
 * `httpOnly: false` is INTENTIONAL — next-intl reads the cookie client-side
 * to pick the locale on hard navigations. Document it so the pattern doesn't
 * accidentally propagate to cookies that genuinely need httpOnly.
 */
export async function switchLocaleAction(locale: Locale): Promise<void> {
  if (!SUPPORTED_LOCALES.includes(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    maxAge: ONE_YEAR_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    httpOnly: false,
  });

  revalidatePath('/', 'layout');
}
