import { redirect } from 'next/navigation';

import { getTranslations } from 'next-intl/server';

import { BackupPanel } from '@/features/backup/components/backup-panel';
import { getBackupView } from '@/features/backup/services/backup-view.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';

export default async function BackupSettingsPage() {
  if (!(await isCurrentUserAdmin())) redirect('/settings/profile');

  const t = await getTranslations('settings.backup');
  const view = await getBackupView();

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{t('subtitle')}</p>
      </header>

      <BackupPanel view={view} />
    </div>
  );
}
