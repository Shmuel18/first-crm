import Image from 'next/image';

import { getTranslations } from 'next-intl/server';

import { LoginForm } from './login-form';

// Edge runtime: this page is a pure render of getTranslations + JSX. The
// loginAction it submits to still runs on Node (Supabase SSR client needs
// the Node cookie shim), but the *render* drops to ~10 ms cold start
// instead of ~150 ms because there's no Node container spin-up.
export const runtime = 'edge';

type Props = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

// Errors surfaced via redirect from /auth/callback (invalid/expired invite,
// missing code). Anything else lands as a generic "unknown" message.
const ALLOWED_URL_ERROR_KEYS = new Set([
  'invalid_invite',
  'missing_code',
]);

export default async function LoginPage({ searchParams }: Props) {
  const t = await getTranslations('auth.login');
  const { error, next } = await searchParams;

  const urlError = error && ALLOWED_URL_ERROR_KEYS.has(error) ? error : null;

  // Only forward a same-origin app path; the action re-validates server-side.
  const safeNext =
    typeof next === 'string' &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/\\')
      ? next
      : null;

  return (
    <div className="w-full">
      <div className="mb-3 flex justify-center sm:mb-4">
        <div className="relative h-20 w-full max-w-[190px] sm:h-24 sm:max-w-[220px] lg:h-28 lg:max-w-[250px]">
          <Image
            src="/logo.png"
            alt="Kaufman Finance Group"
            fill
            priority
            sizes="280px"
            className="object-contain"
          />
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-2xl sm:p-6" dir="auto">
        <div className="mb-5">
          <h1 className="font-display text-2xl text-neutral-900 mb-1">{t('title')}</h1>
          <p className="text-sm text-neutral-500">{t('subtitle')}</p>
        </div>

        {urlError && (
          <div
            role="alert"
            className="mb-5 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700"
          >
            {t(`errors.${urlError}`)}
          </div>
        )}

        <LoginForm next={safeNext} />
      </div>

      <div className="mt-4 text-center sm:mt-5">
        <div className="text-xs text-neutral-500">{t('footer')}</div>
      </div>
    </div>
  );
}
