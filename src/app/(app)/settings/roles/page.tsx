import { redirect } from 'next/navigation';

import { getLocale, getTranslations } from 'next-intl/server';

import { RolesPermissionsEditor } from '@/features/settings/components/roles-permissions-editor';
import { getRolesPermissions } from '@/features/settings/services/permissions.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import type { Locale } from '@/lib/i18n/direction';

export default async function RolesSettingsPage() {
  if (!(await isCurrentUserAdmin())) redirect('/settings/profile');

  const { roles, permissions, granted } = await getRolesPermissions();
  const t = await getTranslations('settings.roles');
  const locale = (await getLocale()) as Locale;

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{t('subtitle')}</p>
      </header>

      <RolesPermissionsEditor
        roles={roles}
        permissions={permissions}
        granted={granted}
        locale={locale}
      />
    </div>
  );
}
