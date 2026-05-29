import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Calculator } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { MixCalculator } from '@/features/simulators/components/mix-calculator';
import { MixInputSchema, PropertyKindSchema } from '@/features/simulators/schemas/simulator.schema';
import { getScenarioById } from '@/features/simulators/services/scenarios.service';
import { getRegulatoryThresholds } from '@/features/simulators/services/settings.service';
import { userHasPermission } from '@/lib/auth/permissions';
import { asMortgageScenarioId } from '@/lib/types/branded';

export default async function CaseScenarioEditPage({
  params,
}: {
  params: Promise<{ id: string; scenarioId: string }>;
}) {
  const { id, scenarioId } = await params;
  // Editing requires the use_simulators capability, not just view; send
  // view-only users back to the read-only scenario page.
  if (!(await userHasPermission('use_simulators'))) redirect(`/cases/${id}/simulators/${scenarioId}`);

  const [scenario, thresholds, t] = await Promise.all([
    getScenarioById(asMortgageScenarioId(scenarioId)),
    getRegulatoryThresholds(),
    getTranslations('simulators'),
  ]);
  if (!scenario) notFound();

  const parsedMix = MixInputSchema.safeParse(scenario.inputs);
  if (!parsedMix.success) notFound();
  const propertyKind = PropertyKindSchema.catch('first_home').parse(scenario.property_kind);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-gold-soft px-3 py-1 text-sm font-medium text-brand-gold-text">
            <Calculator className="size-4" aria-hidden="true" />
            {t('eyebrow')}
          </div>
          <h1 className="font-display text-3xl font-semibold text-neutral-950">{t('report.editScenario')}</h1>
          <p className="mt-1 text-sm text-neutral-500">{scenario.title}</p>
        </div>
        <Link
          href={`/cases/${id}/simulators/${scenarioId}`}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          {t('report.backToScenario')}
        </Link>
      </header>
      <MixCalculator
        thresholds={thresholds}
        caseId={id}
        primaryBorrowerId={scenario.primary_borrower_id}
        initialInput={parsedMix.data}
        initialPropertyKind={propertyKind}
        scenarioId={scenarioId}
        initialTitle={scenario.title}
        initialConclusion={scenario.advisor_conclusion ?? undefined}
      />
    </div>
  );
}
