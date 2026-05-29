import { Document } from '@react-pdf/renderer';

import { ensureHebrewFontRegistered } from '@/features/cases/pdf/fonts';
import type { Locale } from '@/lib/i18n/direction';

import type { ScenarioReportData } from './report-data.service';
import { ReportPage } from './report-page';
import { getReportStrings } from './report-strings';

/**
 * Client simulation report orchestrator — a pure function of (data, locale).
 * No fetching, no Date.now() during render (React purity). Reuses the bank
 * PDF's Hebrew font registration: react-pdf's Font is a process-wide
 * singleton, so registering once covers every document in the process.
 */
ensureHebrewFontRegistered();

export function ReportDocument({ data, locale }: { data: ScenarioReportData; locale: Locale }) {
  const strings = getReportStrings(locale);
  return (
    <Document title={strings.documentTitle(data.meta.title)}>
      <ReportPage data={data} strings={strings} locale={locale} />
    </Document>
  );
}
