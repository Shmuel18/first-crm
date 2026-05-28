import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Calculator } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { MixCalculator } from '@/features/simulators/components/mix-calculator';
import { SavedScenariosList } from '@/features/simulators/components/saved-scenarios-list';
import { listScenariosForCase } from '@/features/simulators/services/scenarios.service';
import { getRegulatoryThresholds } from '@/features/simulators/services/settings.service';
import { getCaseById } from '@/features/cases/services/cases.service';
import { userHasPermission } from '@/lib/auth/permissions';
import { asCaseId } from '@/lib/types/branded';
import type { MixInput } from '@/features/simulators/types';

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
          <p className="mt-1 text-sm text-neutral-500">{caseData.case_number}</p>
        </div>
        <Link href={`/cases/${id}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          {t('backToCase')}
        </Link>
      </header>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <MixCalculator
          thresholds={thresholds}
          caseId={id}
          primaryBorrowerId={caseData.primary_borrower_id}
          initialInput={buildInitialInput(caseData)}
        />
        <SavedScenariosList scenarios={scenarios} caseId={id} />
      </div>
    </div>
  );
}

function buildInitialInput(caseData: NonNullable<Awaited<ReturnType<typeof getCaseById>>>): MixInput {
  const mortgage = Math.max(1, Number(caseData.requested_mortgage_amount ?? 800000) * 100);
  const property = Math.max(mortgage, Number(caseData.property_value ?? 1200000) * 100);
  const equity = Math.max(0, Number(caseData.equity ?? property / 100 - mortgage / 100) * 100);
  return {
    mortgageAmount: mortgage,
    propertyValue: property,
    equity,
    defaultTermMonths: 360,
    tracks: [
      { id: 'case-fixed', type: 'fixed_unlinked', amount: Math.round(mortgage / 3), annualRatePct: 4.5, termMonths: 360, repayment: 'spitzer', cpiAnnualPct: null, graceMonths: null },
      { id: 'case-prime', type: 'prime', amount: Math.round(mortgage / 3), annualRatePct: 6, termMonths: 360, repayment: 'spitzer', cpiAnnualPct: null, graceMonths: null },
      { id: 'case-variable', type: 'variable_linked', amount: mortgage - Math.round(mortgage / 3) * 2, annualRatePct: 4.2, termMonths: 360, repayment: 'spitzer', cpiAnnualPct: 2.5, graceMonths: null },
    ],
  };
}
