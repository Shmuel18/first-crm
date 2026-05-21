import { redirect } from 'next/navigation';

import { getLocale, getTranslations } from 'next-intl/server';

import { ProfileForm } from '@/features/settings/components/profile-form';
import { getMyProfile } from '@/features/settings/services/settings.service';
import { parseLocale } from '@/lib/i18n/direction';

export default async function ProfileSettingsPage() {
  const profile = await getMyProfile();
  if (!profile) redirect('/login');

  const t = await getTranslations('settings.profile');
  const locale = parseLocale(await getLocale());
  const roleName =
    (locale === 'he' ? profile.roleNameHe : profile.roleNameEn) ?? '';

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{t('subtitle')}</p>
      </header>

      <ProfileForm profile={profile} roleName={roleName} />
    </div>
  );
}
