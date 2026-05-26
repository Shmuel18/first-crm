import Image from 'next/image';

import { getTranslations } from 'next-intl/server';

import { ForgotPasswordForm } from './forgot-password-form';

// See login/page.tsx — same edge-runtime trade-off applies here.
export const runtime = 'edge';

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth.forgotPassword');

  return (
    <div className="w-full">
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
          <p className="text-sm text-neutral-500">{t('subtitle')}</p>
        </div>

        <ForgotPasswordForm />
      </div>
    </div>
  );
}
