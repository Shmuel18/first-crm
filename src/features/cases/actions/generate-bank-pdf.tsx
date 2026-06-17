'use server';

import { renderToBuffer } from '@react-pdf/renderer';

import { getLocale } from 'next-intl/server';
import { z } from 'zod';

import { getCurrentUser } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { checkRateLimit } from '@/lib/rate-limit';
import { asCaseId } from '@/lib/types/branded';

import { loadCaseForBankPdf } from '../pdf/bank-pdf-data.service';
import { BankPdfDocument } from '../pdf/bank-pdf-document';

type Result =
  | { ok: true; base64: string; filename: string }
  | { ok: false; error: 'unauthorized' | 'rate_limited' | 'not_found' | 'render_failed' };

/**
 * Render the case as a bank-submission PDF on the server and ship it back to
 * the browser as base64 (small enough — the document is mostly text). The
 * client converts to a blob and triggers a download.
 *
 * Authorization is layered: an explicit auth check + Zod-validated id + a
 * rate limit here (this is an expensive @react-pdf render — CLAUDE.md requires
 * checkRateLimit on export-pdf; mirrors generate-report-pdf.tsx), then RLS on
 * the case read inside loadCaseForBankPdf decides if the caller may see it.
 * Returning null = no visible row = "not_found" (we intentionally don't
 * distinguish from "unauthorized" — RLS makes them indistinguishable on the
 * read side, and surfacing the difference would leak whether the case exists).
 */
export async function generateBankPdfAction(caseId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  // Validate the id BEFORE any DB / render work. A malformed id resolves to
  // not_found (same as a not-visible case) so existence never leaks.
  const parsed = z.uuid().safeParse(caseId);
  if (!parsed.success) return { ok: false, error: 'not_found' };

  // Throttle the expensive render per user (fail-closed, like the bulk export
  // route + the simulator report action).
  const allowed = await checkRateLimit({
    action: 'export_bank_pdf',
    subject: `user:${user.id}`,
    max: 30,
    windowSeconds: 3600,
    failMode: 'closed',
  });
  if (!allowed) return { ok: false, error: 'rate_limited' };

  const data = await loadCaseForBankPdf(asCaseId(parsed.data));
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
    // Never ship the raw renderer error to the client — log it server-side and
    // return a generic code the UI maps to a translated string.
    console.error('[generateBankPdf] render failed', err);
    return { ok: false, error: 'render_failed' };
  }
}
