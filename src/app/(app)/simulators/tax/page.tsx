import { redirect } from 'next/navigation';

import { ReceiptText } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { SimulatorToolsNav } from '@/features/simulators/components/simulator-tools-nav';
import { TaxCostsCalculator } from '@/features/simulators/components/tax-costs-calculator';
import { userHasPermission } from '@/lib/auth/permissions';

export default async function TaxSimulatorPage() {
  if (!(await userHasPermission('view_simulators'))) redirect('/cases');
  const t = await getTranslations('simulators.tax');

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-gold-soft px-3 py-1 text-sm font-medium text-brand-gold-text">
            <ReceiptText className="size-4" aria-hidden="true" />
            {t('eyebrow')}
          </div>
          <h1 className="font-display text-3xl font-semibold text-neutral-950">{t('title')}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-500">{t('subtitle')}</p>
        </div>
      </header>
      <SimulatorToolsNav basePath="/simulators" />
      <TaxCostsCalculator />
    </div>
  );
}
