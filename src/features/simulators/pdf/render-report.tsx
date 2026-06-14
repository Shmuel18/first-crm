import { renderToBuffer } from '@react-pdf/renderer';

import { asMortgageScenarioId } from '@/lib/types/branded';

import { loadScenarioReport } from './report-data.service';
import { ReportDocument } from './report-document';

import type { ComponentProps } from 'react';

type ReportLocale = ComponentProps<typeof ReportDocument>['locale'];

/**
 * Render a saved scenario's client report to a PDF Buffer. Shared by the
 * download action (base64 → browser download) and the email-to-client action
 * (attach the buffer), so both produce a byte-identical document.
 * `advisorConclusion === undefined` keeps whatever was persisted at save time;
 * null/'' clears it. Returns null when the scenario is unreadable (RLS / 404).
 */
export async function renderScenarioReportPdf(
  scenarioId: string,
  advisorConclusion: string | null | undefined,
  locale: ReportLocale,
): Promise<{ buffer: Buffer; filename: string } | null> {
  const data = await loadScenarioReport(asMortgageScenarioId(scenarioId));
  if (!data) return null;
  if (advisorConclusion !== undefined) data.meta.advisorConclusion = advisorConclusion;
  const buffer = await renderToBuffer(<ReportDocument data={data} locale={locale} />);
  return { buffer, filename: `kaufman-simulation-${scenarioId.slice(0, 8)}.pdf` };
}
