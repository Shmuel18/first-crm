import { Document } from '@react-pdf/renderer';

import type { BankPdfData } from './bank-pdf-data.service';
import { CoverPage } from './cover-page';
import { ensureHebrewFontRegistered } from './fonts';
import { PropertyPage } from './property-page';
import { SummaryPage } from './summary-page';

/**
 * Bank-submission PDF orchestrator. Three pages, each a separate component
 * file (see ./cover-page, ./property-page, ./summary-page). Styles live in
 * ./styles, formatters in ./formatters, and small reusable widgets in
 * ./shared. The data shape comes from ./bank-pdf-data.service so this
 * component is a pure function of data — no fetching, no Date.now() inside
 * render (React purity), no business logic.
 *
 * Font registration runs once at module load — react-pdf's Font is a
 * process-wide singleton, so HMR can't re-register cleanly. See ./fonts
 * for the data-URL self-host workaround.
 */
ensureHebrewFontRegistered();

export function BankPdfDocument({ data }: { data: BankPdfData }) {
  return (
    <Document title={`בקשה למשכנתא — תיק ${data.case.caseNumber}`}>
      <CoverPage data={data} />
      <PropertyPage data={data} />
      <SummaryPage data={data} />
    </Document>
  );
}
