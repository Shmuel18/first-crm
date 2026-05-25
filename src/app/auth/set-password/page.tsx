import Image from 'next/image';
import { redirect } from 'next/navigation';

import { getTranslations } from 'next-intl/server';

import { createClient } from '@/lib/supabase/server';

import { SetPasswordForm } from './set-password-form';

/**
 * Standalone /auth/set-password page (outside the (auth) route group because
 * it requires a session and shouldn't trigger the "auth route → redirect to
 * /cases" branch in proxy.ts). Mirrors the (auth) layout's dark hero so the
 * new user feels they're still inside the auth flow.
 */
export default async function SetPasswordPage() {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect('/login');

  const t = await getTranslations('auth.setPassword');

  return (
    <div className="h-dvh overflow-y-auto scrollbar-thin flex items-center justify-center bg-brand-black p-4 relative">
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-brand-gold opacity-5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-brand-gold opacity-5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-10">
          <div className="relative h-40 w-full max-w-[280px]">
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

        <div className="bg-white rounded-2xl shadow-2xl p-8" dir="auto">
          <div className="mb-6">
            <h1 className="font-display text-2xl text-neutral-900 mb-1">{t('title')}</h1>
            <p className="text-sm text-neutral-500">
              {t('subtitle', { email: userRes.user.email ?? '' })}
            </p>
          </div>

          <SetPasswordForm />
        </div>
      </div>
    </div>
  );
}
