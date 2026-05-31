'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

import { env } from '@/lib/env';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/direction';
import { createClient } from '@/lib/supabase/server';

const LOCALE_COOKIE = 'NEXT_LOCALE';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Updates the user's preferred UI locale.
 *
 * Writes to BOTH the NEXT_LOCALE cookie (so next-intl picks it up on the
 * next render) AND `profiles.language` (so the profile-settings dropdown
 * stays in sync with the top-bar quick switcher). Without the DB write
 * the two surfaces drift: switching in the top bar would change the
 * interface but the profile page would still show the old saved value.
 *
 * `httpOnly: false` on the cookie is INTENTIONAL — next-intl reads it
 * client-side on hard navigations. Don't propagate the flag elsewhere.
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

  // The cookie set above is what flips the UI. The profiles.language mirror
  // is only for cross-device persistence, so push it past the response with
  // `after()` (serverless-safe) — the user doesn't wait on getUser() + the
  // UPDATE before the locale change takes effect. Best-effort: a failed
  // write (RLS / network) is logged, and the next profile save reconciles.
  after(async () => {
    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ language: locale, updated_by: userRes.user.id })
      .eq('id', userRes.user.id);
    if (error) {
      console.error('[switchLocale] profile mirror failed', {
        userId: userRes.user.id,
        locale,
        code: error.code ?? null,
        message: error.message ?? null,
      });
    }
  });

  revalidatePath('/', 'layout');
}
