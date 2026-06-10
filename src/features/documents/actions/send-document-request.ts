'use server';

import { getLocale } from 'next-intl/server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { DocumentRequestEmailSchema } from '../schemas/document-request.schema';
import { sendDocumentRequestEmail } from '../services/document-request-email';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'no_email' | 'not_configured' | 'unknown' };

/**
 * Sends the advisor-reviewed document-request email to the case's primary
 * borrower. The dialog prefills the text (greeting + missing-docs list) and
 * the advisor edits before sending — the server validates, authorizes, and
 * wraps the final text in the branded layout.
 */
export async function sendDocumentRequestAction(input: unknown): Promise<Result> {
  const parsed = DocumentRequestEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'unknown' };
  const { caseId, subject, body } = parsed.data;

  const supabase = await createClient();
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  const { data: caseRow } = await supabase
    .from('cases')
    .select('primary_borrower_id')
    .eq('id', caseId)
    .maybeSingle();
  const borrowerId = caseRow?.primary_borrower_id;
  if (!borrowerId) return { ok: false, error: 'no_email' };

  const { data: borrower } = await supabase
    .from('borrowers')
    .select('email')
    .eq('id', borrowerId)
    .maybeSingle();
  const email = borrower?.email?.trim();
  if (!email) return { ok: false, error: 'no_email' };

  // Shell direction follows the advisor's UI locale — that's the language
  // the prefilled text was written in (and edited under).
  const locale = (await getLocale()) === 'en' ? 'en' : 'he';
  const sent = await sendDocumentRequestEmail({ to: email, locale, subject, bodyText: body });
  if (sent === 'skipped') return { ok: false, error: 'not_configured' };
  if (sent === 'failed') return { ok: false, error: 'unknown' };
  return { ok: true };
}
