import { redirect } from 'next/navigation';

import { getTranslations } from 'next-intl/server';

import { TemplatesManager } from '@/features/templates/components/templates-manager';
import { listMessageTemplates } from '@/features/templates/services/templates.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';

export default async function TemplatesSettingsPage() {
  if (!(await isCurrentUserAdmin())) redirect('/settings/profile');

  const t = await getTranslations('templates');
  const templates = await listMessageTemplates();

  return (
    <div>
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{t('subtitle')}</p>
      </header>

      <TemplatesManager templates={templates} />
    </div>
  );
}
