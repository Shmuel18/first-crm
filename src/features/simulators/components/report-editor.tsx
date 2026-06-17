'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { ScenarioReportActions } from './scenario-report-actions';

type Props = { scenarioId: string; initialConclusion: string | null };

/**
 * Advisor-facing report editor: a free-text conclusion seeded from the saved
 * scenario, plus the download / send-to-client actions (shared component). The
 * edited conclusion rides with both requests so the PDF reflects the live text.
 */
export function ReportEditor({ scenarioId, initialConclusion }: Props) {
  const t = useTranslations('simulators.report');
  const [conclusion, setConclusion] = useState(initialConclusion ?? '');

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <label htmlFor="advisor-conclusion" className="block text-sm font-medium text-neutral-700">
        {t('conclusionLabel')}
      </label>
      <textarea
        id="advisor-conclusion"
        value={conclusion}
        onChange={(event) => setConclusion(event.target.value)}
        placeholder={t('conclusionPlaceholder')}
        maxLength={4000}
        rows={6}
        className="mt-2 w-full resize-y rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-brand-gold-dark focus:outline-none focus:ring-2 focus:ring-brand-gold-text/30"
      />
      <div className="mt-4 flex justify-end">
        <ScenarioReportActions scenarioId={scenarioId} conclusion={conclusion} canSend />
      </div>
    </section>
  );
}
