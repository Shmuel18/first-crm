import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { RegulatoryThresholdsForm } from '@/features/simulators/components/settings/regulatory-thresholds-form';
import { getRegulatoryThresholds } from '@/features/simulators/services/settings.service';
import { userHasPermission } from '@/lib/auth/permissions';

export default async function SimulatorSettingsPage() {
  if (!(await userHasPermission('manage_simulator_settings'))) redirect('/settings/profile');
  const [thresholds, t] = await Promise.all([
    getRegulatoryThresholds(),
    getTranslations('settings.simulators'),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl font-semibold text-neutral-950">{t('pageTitle')}</h2>
        <p className="mt-1 text-sm text-neutral-500">{t('pageSubtitle')}</p>
      </header>
      <RegulatoryThresholdsForm thresholds={thresholds} />
    </div>
  );
}
