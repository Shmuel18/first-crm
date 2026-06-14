import { redirect } from 'next/navigation';

import { getLocale, getTranslations } from 'next-intl/server';

import { RecycleBinList } from '@/features/cases/components/recycle-bin-list';
import { listDeletedCases } from '@/features/cases/services/deleted-cases.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';

export default async function RecycleBinSettingsPage() {
  if (!(await isCurrentUserAdmin())) redirect('/settings/profile');

  const t = await getTranslations('settings.recycleBin');
  const locale = parseLocale(await getLocale());
  const { rows, retentionPaused } = await listDeletedCases();

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{t('subtitle')}</p>
      </header>

      <RecycleBinList rows={rows} locale={locale} retentionPaused={retentionPaused} />
    </div>
  );
}
