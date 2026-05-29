import Link from 'next/link';
import { FileText } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { MortgageScenarioWithTracks } from '../services/scenarios.service';
import { formatMoney } from '../utils/format';

type Props = { scenarios: ReadonlyArray<MortgageScenarioWithTracks>; caseId?: string };

export async function SavedScenariosList({ scenarios, caseId }: Props) {
  const t = await getTranslations('simulators.saved');
  const href = caseId ? `/cases/${caseId}/simulators/mix` : '/simulators/mix';

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-neutral-950">{t('title')}</h2>
        <Link href={href} className="text-sm font-medium text-brand-gold-text hover:underline">{t('new')}</Link>
      </div>
      {scenarios.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">{t('empty')}</div>
      ) : (
        <div className="space-y-2">
          {scenarios.slice(0, 6).map((scenario) => (
            <ScenarioRow key={scenario.id} scenario={scenario} caseId={caseId} tracksLabel={t('tracks')} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * A saved-scenario row. When the list is rendered inside a case it links to the
 * read-only scenario view (the report entry point); standalone sketches have no
 * case-scoped view route, so they render as a static row.
 */
function ScenarioRow({
  scenario,
  caseId,
  tracksLabel,
}: {
  scenario: MortgageScenarioWithTracks;
  caseId?: string;
  tracksLabel: string;
}) {
  const body = (
    <>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-neutral-950">{scenario.title}</div>
        <div className="text-xs text-neutral-500">
          {formatMoney(scenario.mortgage_amount)} · {scenario.scenario_tracks.length} {tracksLabel}
        </div>
      </div>
      <FileText className="size-4 shrink-0 text-brand-gold-text" aria-hidden="true" />
    </>
  );

  if (!caseId) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={`/cases/${caseId}/simulators/${scenario.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 transition hover:border-brand-gold-dark hover:bg-brand-gold-soft"
    >
      {body}
    </Link>
  );
}
