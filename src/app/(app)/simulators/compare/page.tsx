import { redirect } from 'next/navigation';
import { Calculator } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { MixComparison } from '@/features/simulators/components/mix-comparison';
import { SimulatorToolsNav } from '@/features/simulators/components/simulator-tools-nav';
import { getRegulatoryThresholds } from '@/features/simulators/services/settings.service';
import { userHasPermission } from '@/lib/auth/permissions';

export default async function StandaloneComparePage() {
  if (!(await userHasPermission('view_simulators'))) redirect('/cases');
  const [thresholds, t] = await Promise.all([
    getRegulatoryThresholds(),
    getTranslations('simulators'),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-gold-soft px-3 py-1 text-sm font-medium text-brand-gold-text">
          <Calculator className="size-4" aria-hidden="true" />
          {t('eyebrow')}
        </div>
        <h1 className="font-display text-3xl font-semibold text-neutral-950">{t('compare.title')}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t('compare.subtitle')}</p>
      </header>
      <SimulatorToolsNav basePath="/simulators" />
      <MixComparison thresholds={thresholds} />
    </div>
  );
}
