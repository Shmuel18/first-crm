import { redirect } from 'next/navigation';

import { getTranslations } from 'next-intl/server';

import { SecurityForm } from '@/features/settings/components/security-form';
import { createClient } from '@/lib/supabase/server';

export default async function SecuritySettingsPage() {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect('/login');

  const t = await getTranslations('settings.security');

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{t('subtitle')}</p>
      </header>

      <SecurityForm />
    </div>
  );
}
