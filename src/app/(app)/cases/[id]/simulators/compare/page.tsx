import { notFound, redirect } from 'next/navigation';
import { Calculator } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { BackLink } from '@/components/shared/back-link';
import { parseLocale } from '@/lib/i18n/direction';
import { MixComparison } from '@/features/simulators/components/mix-comparison';
import { SimulatorToolsNav } from '@/features/simulators/components/simulator-tools-nav';
import { getRegulatoryThresholds } from '@/features/simulators/services/settings.service';
import { seedBaseFromCase } from '@/features/simulators/utils/seed-mix';
import { getCaseClientLabelFull } from '@/features/cases/domain/case-derivations';
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

  const locale = parseLocale(await getLocale());

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <BackLink href={`/cases/${id}`} label={t('backToCase')} locale={locale} className="mb-3" />
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-gold-soft px-3 py-1 text-sm font-medium text-brand-gold-text">
          <Calculator className="size-4" aria-hidden="true" />
          {t('eyebrow')}
        </div>
        <h1 className="font-display text-3xl font-semibold text-neutral-950">{t('compare.caseTitle')}</h1>
        <p className="mt-1 text-sm text-neutral-500">{getCaseClientLabelFull(caseData) || caseData.case_number}</p>
      </header>
      <SimulatorToolsNav basePath={`/cases/${id}/simulators`} />
      <MixComparison thresholds={thresholds} initialBase={seedBaseFromCase(caseData)} />
    </div>
  );
}
