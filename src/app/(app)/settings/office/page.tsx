import { redirect } from 'next/navigation';

import { getTranslations } from 'next-intl/server';

import { OfficeForm } from '@/features/settings/components/office-form';
import { getOfficeSettings } from '@/features/settings/services/settings.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';

export default async function OfficeSettingsPage() {
  if (!(await isCurrentUserAdmin())) redirect('/settings/profile');

  const office = await getOfficeSettings();
  if (!office) redirect('/settings/profile');

  const t = await getTranslations('settings.office');

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{t('subtitle')}</p>
      </header>

      <OfficeForm office={office} />
    </div>
  );
}
