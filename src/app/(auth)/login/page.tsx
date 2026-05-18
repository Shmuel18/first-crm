import { getTranslations } from 'next-intl/server';

import { LoginForm } from './login-form';

export default async function LoginPage() {
  const t = await getTranslations('auth.login');

  return (
    <div className="w-full">
      <div className="text-center mb-10">
        <div className="brand-logo text-5xl mb-2 leading-none">KAUFMAN</div>
        <div className="brand-tagline">FINANCE · TRUST · EXCELLENCE</div>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl p-8" dir="auto">
        <div className="mb-6">
          <h1 className="font-display text-2xl text-neutral-900 mb-1">{t('title')}</h1>
          <p className="text-sm text-neutral-500">{t('subtitle')}</p>
        </div>

        <LoginForm />
      </div>

      <div className="mt-8 text-center">
        <div className="text-xs text-neutral-500">{t('footer')}</div>
      </div>
    </div>
  );
}
