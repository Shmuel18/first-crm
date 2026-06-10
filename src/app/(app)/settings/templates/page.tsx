import { redirect } from 'next/navigation';

import { getTranslations } from 'next-intl/server';

import { TemplatesManager } from '@/features/templates/components/templates-manager';
import { listMessageTemplates } from '@/features/templates/services/templates.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';

export default async function TemplatesSettingsPage() {
  if (!(await isCurrentUserAdmin())) redirect('/settings/profile');

  const templates = await listMessageTemplates();
  const t = await getTranslations('templates');

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="mt-0.5 text-sm text-neutral-500">{t('subtitle')}</p>
      </header>

      <TemplatesManager templates={templates} />
    </div>
  );
}
