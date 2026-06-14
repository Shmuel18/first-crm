import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ArrowRight, WalletCards } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import {
  AffordabilityCalculator,
  type AffordabilityCalculatorInitialState,
} from '@/features/simulators/components/affordability-calculator';
import { SimulatorToolsNav } from '@/features/simulators/components/simulator-tools-nav';
import { getCaseClientLabel } from '@/features/cases/domain/case-derivations';
import { getCaseById } from '@/features/cases/services/cases.service';
import { listIncomesForCase } from '@/features/incomes/services/incomes.service';
import { listObligationsFlatForCase } from '@/features/obligations/services/obligations.service';
import { seedBaseFromCase } from '@/features/simulators/utils/seed-mix';
import { userHasPermission } from '@/lib/auth/permissions';
import { asCaseId } from '@/lib/types/branded';

export default async function CaseAffordabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await userHasPermission('view_simulators'))) redirect('/cases');

  const { id } = await params;
  const caseId = asCaseId(id);
  const [caseData, incomeGroups, obligations, t] = await Promise.all([
    getCaseById(caseId),
    listIncomesForCase(caseId),
    listObligationsFlatForCase(caseId),
    getTranslations('simulators'),
  ]);
  if (!caseData) notFound();

  const base = seedBaseFromCase(caseData);
  const initialState: AffordabilityCalculatorInitialState = {
    propertyValue: base.propertyValue,
    equity: base.equity,
    requestedMortgage: base.mortgageAmount,
    netIncome: nisToAgorot(incomeGroups.reduce((sum, group) => sum + group.monthlyTotal, 0)),
    obligations: nisToAgorot(obligations.monthlyPaymentTotal),
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-gold-soft px-3 py-1 text-sm font-medium text-brand-gold-text">
            <WalletCards className="size-4" aria-hidden="true" />
            {t('eyebrow')}
          </div>
          <h1 className="font-display text-3xl font-semibold text-neutral-950">
            {t('affordability.title')}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{getCaseClientLabel(caseData) || caseData.case_number}</p>
        </div>
        <Link
          href={`/cases/${id}`}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          {t('backToCase')}
        </Link>
      </header>
      <SimulatorToolsNav basePath={`/cases/${id}/simulators`} />
      <AffordabilityCalculator initialState={initialState} />
    </div>
  );
}

function nisToAgorot(value: number): number {
  return Math.max(0, Math.round(value * 100));
}
