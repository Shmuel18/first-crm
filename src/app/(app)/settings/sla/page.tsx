import { redirect } from 'next/navigation';

import { getLocale, getTranslations } from 'next-intl/server';

import { SlaForm } from '@/features/settings/components/sla-form';
import { getSlaThresholds, listSlaStatuses } from '@/features/settings/services/sla.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';

export default async function SlaSettingsPage() {
  if (!(await isCurrentUserAdmin())) redirect('/settings/profile');

  const [statuses, thresholds] = await Promise.all([
    listSlaStatuses(),
    getSlaThresholds(),
  ]);

  const t = await getTranslations('settings.sla');
  const locale = parseLocale(await getLocale());

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h2 className="font-display text-xl font-semibold text-neutral-900">{t('title')}</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{t('subtitle')}</p>
      </header>

      <SlaForm statuses={statuses} thresholds={thresholds} locale={locale} />
    </div>
  );
}
