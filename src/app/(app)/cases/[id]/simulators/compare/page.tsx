import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Calculator } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { MixComparison } from '@/features/simulators/components/mix-comparison';
import { SimulatorToolsNav } from '@/features/simulators/components/simulator-tools-nav';
import type { ComparisonBase } from '@/features/simulators/hooks/use-mix-comparison';
import { getRegulatoryThresholds } from '@/features/simulators/services/settings.service';
import { getCaseById } from '@/features/cases/services/cases.service';
import { userHasPermission } from '@/lib/auth/permissions';
import { asCaseId } from '@/lib/types/branded';

export default async function CaseComparePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await userHasPermission('view_simulators'))) redirect('/cases');
  const { id } = await params;
  const caseId = asCaseId(id);
  const [caseData, thresholds, t] = await Promise.all([
    getCaseById(caseId),
    getRegulatoryThresholds(),
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
          <h1 className="font-display text-3xl font-semibold text-neutral-950">{t('compare.caseTitle')}</h1>
          <p className="mt-1 text-sm text-neutral-500">{caseData.case_number}</p>
        </div>
        <Link href={`/cases/${id}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          {t('backToCase')}
        </Link>
      </header>
      <SimulatorToolsNav basePath={`/cases/${id}/simulators`} />
      <MixComparison thresholds={thresholds} initialBase={buildInitialBase(caseData)} />
    </div>
  );
}

function buildInitialBase(caseData: NonNullable<Awaited<ReturnType<typeof getCaseById>>>): ComparisonBase {
  const mortgage = Math.max(1, Number(caseData.requested_mortgage_amount ?? 800000) * 100);
  const property = Math.max(mortgage, Number(caseData.property_value ?? 1200000) * 100);
  const equity = Math.max(0, Number(caseData.equity ?? property / 100 - mortgage / 100) * 100);
  return { mortgageAmount: mortgage, propertyValue: property, equity, defaultTermMonths: 360 };
}
