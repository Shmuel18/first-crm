import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Calculator } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { MixCalculator } from '@/features/simulators/components/mix-calculator';
import { SavedScenariosList } from '@/features/simulators/components/saved-scenarios-list';
import { SimulatorToolsNav } from '@/features/simulators/components/simulator-tools-nav';
import { listScenariosForCase } from '@/features/simulators/services/scenarios.service';
import { getRegulatoryThresholds } from '@/features/simulators/services/settings.service';
import { getCaseClientLabel } from '@/features/cases/domain/case-derivations';
import { getCaseById } from '@/features/cases/services/cases.service';
import { seedMixFromCase } from '@/features/simulators/utils/seed-mix';
import { userHasPermission } from '@/lib/auth/permissions';
import { asCaseId } from '@/lib/types/branded';

export default async function CaseMixPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await userHasPermission('view_simulators'))) redirect('/cases');
  const { id } = await params;
  const caseId = asCaseId(id);
  const [caseData, thresholds, scenarios, t] = await Promise.all([
    getCaseById(caseId),
    getRegulatoryThresholds(),
    listScenariosForCase(caseId),
    getTranslations('simulators'),
  ]);
  if (!caseData) notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-gold-soft px-3 py-1 text-sm font-medium text-brand-gold-text">
            <Calculator className="size-4" aria-hidden="true" />
            {t('eyebrow')}
          </div>
          <h1 className="font-display text-3xl font-semibold text-neutral-950">{t('mix.caseTitle')}</h1>
          <p className="mt-1 text-sm text-neutral-500">{getCaseClientLabel(caseData) || caseData.case_number}</p>
        </div>
        <Link href={`/cases/${id}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          {t('backToCase')}
        </Link>
      </header>
      <SimulatorToolsNav basePath={`/cases/${id}/simulators`} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <MixCalculator
          thresholds={thresholds}
          caseId={id}
          primaryBorrowerId={caseData.primary_borrower_id}
          initialInput={seedMixFromCase(caseData)}
        />
        <SavedScenariosList scenarios={scenarios} caseId={id} />
      </div>
    </div>
  );
}
