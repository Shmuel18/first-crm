import { Document } from '@react-pdf/renderer';

import type { Locale } from '@/lib/i18n/direction';

import type { BankPdfData } from './bank-pdf-data.service';
import { CoverPage } from './cover-page';
import { ensureHebrewFontRegistered } from './fonts';
import { MixPage } from './mix-page';
import { PropertyPage } from './property-page';
import { getPdfStrings } from './strings';
import { SummaryPage } from './summary-page';

/**
 * Bank-submission PDF orchestrator. Three pages, each a separate component
 * file (see ./cover-page, ./property-page, ./summary-page). Styles live in
 * ./styles, formatters in ./formatters, localized strings in ./strings,
 * and small reusable widgets in ./shared. The data shape comes from
 * ./bank-pdf-data.service so this component is a pure function of
 * (data, locale) — no fetching, no Date.now() inside render (React
 * purity), no business logic.
 *
 * Font registration runs once at module load — react-pdf's Font is a
 * process-wide singleton, so HMR can't re-register cleanly. See ./fonts
 * for the data-URL self-host workaround.
 */
ensureHebrewFontRegistered();

export function BankPdfDocument({
  data,
  locale,
}: {
  data: BankPdfData;
  locale: Locale;
}) {
  const strings = getPdfStrings(locale);
  return (
    <Document title={strings.documentTitle(data.case.caseNumber)}>
      <CoverPage data={data} strings={strings} locale={locale} />
      <PropertyPage data={data} strings={strings} locale={locale} />
      <SummaryPage data={data} strings={strings} locale={locale} />
      {data.mix && <MixPage data={{ ...data, mix: data.mix }} strings={strings} locale={locale} />}
    </Document>
  );
}
