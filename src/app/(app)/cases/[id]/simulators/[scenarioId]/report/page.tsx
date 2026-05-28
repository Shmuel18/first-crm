import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Calculator } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { ReportEditor } from '@/features/simulators/components/report-editor';
import { ScenarioSummary } from '@/features/simulators/components/scenario-summary';
import { loadScenarioReport } from '@/features/simulators/pdf/report-data.service';
import { userHasPermission } from '@/lib/auth/permissions';
import { asMortgageScenarioId } from '@/lib/types/branded';

export default async function CaseScenarioReportPage({
  params,
}: {
  params: Promise<{ id: string; scenarioId: string }>;
}) {
  if (!(await userHasPermission('view_simulators'))) redirect('/cases');
  const { id, scenarioId } = await params;
  const [data, t] = await Promise.all([
    loadScenarioReport(asMortgageScenarioId(scenarioId)),
    getTranslations('simulators'),
  ]);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-gold-soft px-3 py-1 text-sm font-medium text-brand-gold-text">
            <Calculator className="size-4" aria-hidden="true" />
            {t('eyebrow')}
          </div>
          <h1 className="font-display text-3xl font-semibold text-neutral-950">{t('report.title')}</h1>
          <p className="mt-1 text-sm text-neutral-500">{t('report.subtitle')}</p>
        </div>
        <Link
          href={`/cases/${id}/simulators/${scenarioId}`}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          {t('report.backToScenario')}
        </Link>
      </header>
      <ScenarioSummary data={data} />
      <ReportEditor scenarioId={scenarioId} initialConclusion={data.meta.advisorConclusion} />
    </div>
  );
}
