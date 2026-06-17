import { redirect } from 'next/navigation';

import { getTranslations } from 'next-intl/server';

import { ChecklistTemplatesManager } from '@/features/settings/components/checklist-templates-manager';
import { listChecklistTemplatesForAdmin } from '@/features/settings/services/checklist-templates.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';

export default async function ChecklistTemplatesSettingsPage() {
  if (!(await isCurrentUserAdmin())) redirect('/settings/profile');

  const templates = await listChecklistTemplatesForAdmin();
  const t = await getTranslations('settings.checklists');

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="mt-0.5 text-sm text-neutral-500">{t('subtitle')}</p>
      </header>

      <ChecklistTemplatesManager templates={templates} />
    </div>
  );
}
