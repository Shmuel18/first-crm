import { redirect } from 'next/navigation';
import { Calculator } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { MixCalculator } from '@/features/simulators/components/mix-calculator';
import { SavedScenariosList } from '@/features/simulators/components/saved-scenarios-list';
import { SimulatorToolsNav } from '@/features/simulators/components/simulator-tools-nav';
import { listStandaloneScenarios } from '@/features/simulators/services/scenarios.service';
import { getRegulatoryThresholds } from '@/features/simulators/services/settings.service';
import { userHasPermission } from '@/lib/auth/permissions';

export default async function StandaloneMixPage() {
  if (!(await userHasPermission('view_simulators'))) redirect('/cases');
  const t = await getTranslations('simulators');
  const [thresholds, scenarios] = await Promise.all([
    getRegulatoryThresholds(),
    listStandaloneScenarios(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-gold-soft px-3 py-1 text-sm font-medium text-brand-gold-text">
            <Calculator className="size-4" aria-hidden="true" />
            {t('eyebrow')}
          </div>
          <h1 className="font-display text-3xl font-semibold text-neutral-950">{t('mix.title')}</h1>
          <p className="mt-1 text-sm text-neutral-500">{t('mix.subtitle')}</p>
        </div>
      </header>
      <SimulatorToolsNav basePath="/simulators" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <MixCalculator thresholds={thresholds} />
        <SavedScenariosList scenarios={scenarios} />
      </div>
    </div>
  );
}
