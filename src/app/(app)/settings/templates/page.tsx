import { redirect } from 'next/navigation';

import { getLocale, getTranslations } from 'next-intl/server';

import { TemplatesManager } from '@/features/templates/components/templates-manager';
import { listSystemEmailTemplates } from '@/features/templates/services/system-email-templates.service';
import { listMessageTemplates } from '@/features/templates/services/templates.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';

export default async function TemplatesSettingsPage() {
  if (!(await isCurrentUserAdmin())) redirect('/settings/profile');

  const [templates, systemTemplates, currentLocale, t] = await Promise.all([
    listMessageTemplates(),
    listSystemEmailTemplates(),
    getLocale(),
    getTranslations('templates'),
  ]);
  const locale = currentLocale === 'en' ? 'en' : 'he';

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="mt-0.5 text-sm text-neutral-500">{t('subtitle')}</p>
      </header>

      <TemplatesManager templates={templates} systemTemplates={systemTemplates} locale={locale} />
    </div>
  );
}
