'use server';

import { renderToBuffer } from '@react-pdf/renderer';

import { getLocale } from 'next-intl/server';

import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

import { loadCaseForBankPdf } from '../pdf/bank-pdf-data.service';
import { BankPdfDocument } from '../pdf/bank-pdf-document';

type Result =
  | { ok: true; base64: string; filename: string }
  | { ok: false; error: 'not_found' | 'render_failed'; message?: string };

/**
 * Render the case as a bank-submission PDF on the server and ship it back to
 * the browser as base64 (small enough — the document is mostly text). The
 * client converts to a blob and triggers a download.
 *
 * Authorization: loadCaseForBankPdf relies on getCaseById, which goes through
 * the request-scoped Supabase client → RLS decides if the caller may see this
 * case. Returning null = no visible row = "not_found" from the user's POV
 * (we intentionally don't distinguish from "unauthorized" — RLS makes them
 * indistinguishable on the read side, and surfacing the difference would
 * leak whether the case exists).
 */
export async function generateBankPdfAction(caseId: string): Promise<Result> {
  const data = await loadCaseForBankPdf(asCaseId(caseId));
  if (!data) return { ok: false, error: 'not_found' };

  // PDF strings follow the user's UI locale. Hebrew stays the default for
  // Israeli mortgage submissions; English unlocks once an advisor's
  // session is set to 'en'.
  const locale = parseLocale(await getLocale());

  try {
    const buffer = await renderToBuffer(<BankPdfDocument data={data} locale={locale} />);
    const base64 = buffer.toString('base64');
    const safeCaseNumber = data.case.caseNumber.replace(/[^\w-]/g, '_');
    return {
      ok: true,
      base64,
      filename: `kaufman_${safeCaseNumber}.pdf`,
    };
  } catch (err) {
    return {
      ok: false,
      error: 'render_failed',
      message: err instanceof Error ? err.message : 'unknown render error',
    };
  }
}
