import { redirect } from 'next/navigation';

import { getTranslations } from 'next-intl/server';

import { ImportPanel } from '@/features/import/components/import-panel';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';

export default async function ImportSettingsPage() {
  if (!(await isCurrentUserAdmin())) redirect('/settings/profile');

  const t = await getTranslations('settings.import');

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{t('subtitle')}</p>
      </header>

      <ImportPanel />
    </div>
  );
}
